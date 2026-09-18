#include "video_server.h"
#include "latest_frame.h"
#include "esp_http_server.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "img_converters.h"
#include <atomic>
#include <cstring>
#include <cstdio>
namespace {
LatestFrame frames; SemaphoreHandle_t mutex=nullptr;
uint8_t* buffers[3]={};std::atomic<bool> viewer{false};
std::atomic<uint32_t> encoded{0},dropped{0};
void streamTask(void* arg) {
  auto* req=static_cast<httpd_req_t*>(arg);uint32_t last=0;
  httpd_resp_set_type(req,"multipart/x-mixed-replace;boundary=carerover");
  httpd_resp_set_hdr(req,"Cache-Control","no-store");
  httpd_resp_set_hdr(req,"Access-Control-Allow-Origin","http://192.168.4.1");
  int64_t lastFrame=esp_timer_get_time();
  for(;;) {
    xSemaphoreTake(mutex,portMAX_DELAY);int slot=frames.acquire(last);size_t length=frames.length(slot);if(slot>=0)last=frames.sequence();xSemaphoreGive(mutex);
    if(slot<0) { if(esp_timer_get_time()-lastFrame>2000000)break;vTaskDelay(pdMS_TO_TICKS(20));continue; }
    lastFrame=esp_timer_get_time();
    char header[128];int n=snprintf(header,sizeof(header),"--carerover\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",unsigned(length));
    bool ok=httpd_resp_send_chunk(req,header,n)==ESP_OK&&httpd_resp_send_chunk(req,reinterpret_cast<char*>(buffers[slot]),length)==ESP_OK&&httpd_resp_send_chunk(req,"\r\n",2)==ESP_OK;
    xSemaphoreTake(mutex,portMAX_DELAY);frames.release(slot);xSemaphoreGive(mutex);
    if(!ok)break;
  }
  httpd_resp_send_chunk(req,nullptr,0);
  httpd_req_async_handler_complete(req);viewer.store(false);vTaskDelete(nullptr);
}
esp_err_t stream(httpd_req_t* req) {
  // Error responses need the same fixed, existing console origin as live video,
  // so the browser can distinguish a busy single-viewer stream from a dead link.
  httpd_resp_set_hdr(req,"Access-Control-Allow-Origin","http://192.168.4.1");
  httpd_resp_set_hdr(req,"Cache-Control","no-store");
  if(viewer.exchange(true)) {httpd_resp_set_status(req,"503 Service Unavailable");return httpd_resp_send(req,"Video viewer busy",HTTPD_RESP_USE_STRLEN);}
  httpd_req_t* async=nullptr;
  if(httpd_req_async_handler_begin(req,&async)!=ESP_OK){viewer.store(false);return ESP_FAIL;}
  if(xTaskCreate(streamTask,"mjpeg",4096,async,2,nullptr)!=pdPASS){httpd_resp_set_status(async,"503 Service Unavailable");httpd_resp_send(async,"No stream task",HTTPD_RESP_USE_STRLEN);httpd_req_async_handler_complete(async);viewer.store(false);}
  return ESP_OK;
}
}
bool videoBegin() {
  mutex=xSemaphoreCreateMutex();if(!mutex)return false;
  for(auto& b:buffers) {b=static_cast<uint8_t*>(heap_caps_malloc(LatestFrame::Capacity,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT));if(!b)return false;}
  httpd_config_t c=HTTPD_DEFAULT_CONFIG();c.server_port=80;c.max_open_sockets=3;c.recv_wait_timeout=1;c.send_wait_timeout=1;c.lru_purge_enable=true;
  httpd_handle_t server=nullptr;if(httpd_start(&server,&c)!=ESP_OK)return false;
  httpd_uri_t uri{};uri.uri="/stream";uri.method=HTTP_GET;uri.handler=stream;
  return httpd_register_uri_handler(server,&uri)==ESP_OK;
}
bool videoPublish(camera_fb_t* frame) {
  if(!mutex)return false;
  uint8_t* jpeg=nullptr;size_t size=0;
  if(!frame2jpg(frame,60,&jpeg,&size)||!jpeg||size<4||size>LatestFrame::Capacity||jpeg[0]!=0xff||jpeg[1]!=0xd8||jpeg[size-2]!=0xff||jpeg[size-1]!=0xd9){free(jpeg);++dropped;return false;}
  xSemaphoreTake(mutex,portMAX_DELAY);int slot=frames.writable();xSemaphoreGive(mutex);
  if(slot<0){free(jpeg);++dropped;return false;}
  // Only one producer exists. Until publish(), no reader can acquire this slot.
  memcpy(buffers[slot],jpeg,size);free(jpeg);
  xSemaphoreTake(mutex,portMAX_DELAY);bool ok=frames.publish(slot,size);xSemaphoreGive(mutex);
  if(ok)++encoded;else ++dropped;return ok;
}
uint32_t videoEncoded(){return encoded.load();}
uint32_t videoDropped(){return dropped.load();}
