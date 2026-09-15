#pragma once
#include "esp_camera.h"
#include <cstdint>
bool videoBegin();
bool videoPublish(camera_fb_t* frame);
uint32_t videoEncoded();
uint32_t videoDropped();
