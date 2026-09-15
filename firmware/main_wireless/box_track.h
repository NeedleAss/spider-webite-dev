#pragma once
#include "vision_protocol.h"
#include <algorithm>
namespace carerover {
// Constant-velocity alpha-beta tracking for display and association only.
class BoxTrack {
 public:
  void reset(){*this=BoxTrack{};}
  bool ready(uint64_t now)const{return have_&&now>=last_.receivedMs&&now-last_.receivedMs<=700;}
  float cost(const VisionPacket& p,uint64_t now)const{
    if(!p.found||p.x1<=p.x0||p.y1<=p.y0)return 1000;
    if(!ready(now))return 0;
    const auto predicted=view(now);const float area=float((p.x1-p.x0)*(p.y1-p.y0));
    const float oldArea=float((predicted.x1-predicted.x0)*(predicted.y1-predicted.y0));
    const float ratio=area/std::max(1.f,oldArea),iou=boxIou(predicted,p);
    const float dx=(float(p.x0+p.x1)-float(predicted.x0+predicted.x1))/640.f;
    const float dy=(float(p.y0+p.y1)-float(predicted.y0+predicted.y1))/480.f;
    const float distance=std::sqrt(dx*dx+dy*dy);
    if(iou<.02f&&(distance>.22f||ratio<.45f||ratio>2.2f))return 1000;
    return .55f*(1-iou)+.30f*distance+.15f*std::fabs(std::log(ratio));
  }
  bool update(const VisionPacket& p){
    if(!p.found||p.x1<=p.x0||p.y1<=p.y0)return false;
    if(have_&&(p.seq==last_.seq||p.receivedMs<=last_.receivedMs))return false;
    if(cost(p,p.receivedMs)>=1000)return false;
    const float x=(p.x0+p.x1)*.5f,y=(p.y0+p.y1)*.5f,a=std::log(float((p.x1-p.x0)*(p.y1-p.y0)));
    if(!ready(p.receivedMs)){cx_=x;cy_=y;area_=a;vx_=vy_=va_=0;}
    else{
      const float dt=std::max(.01f,float(p.receivedMs-last_.receivedMs)/1000),alpha=p.score>=450?.55f:.25f;
      const float rx=x-(cx_+vx_*dt),ry=y-(cy_+vy_*dt),ra=a-(area_+va_*dt);
      cx_+=vx_*dt+alpha*rx;cy_+=vy_*dt+alpha*ry;area_+=va_*dt+alpha*ra;
      vx_=std::clamp(vx_+.10f*rx/dt,-160.f,160.f);vy_=std::clamp(vy_+.10f*ry/dt,-120.f,120.f);va_=std::clamp(va_+.10f*ra/dt,-1.f,1.f);
    }
    last_=p;have_=true;return true;
  }
  VisionPacket view(uint64_t now)const{
    VisionPacket p=last_;if(!ready(now)){p.found=false;return p;}
    const float dt=std::min(.7f,float(now-last_.receivedMs)/1000);
    const float ratio=float(last_.x1-last_.x0)/float(last_.y1-last_.y0);
    const float a=std::exp(std::clamp(area_+va_*dt,0.f,11.25f));
    const float w=std::min(320.f,std::sqrt(a*ratio)),h=std::min(240.f,std::sqrt(a/ratio));
    const float x=std::clamp(cx_+vx_*dt,w/2,320-w/2),y=std::clamp(cy_+vy_*dt,h/2,240-h/2);
    p.x0=uint16_t(x-w/2);p.x1=uint16_t(x+w/2);p.y0=uint16_t(y-h/2);p.y1=uint16_t(y+h/2);return p;
  }
 private:
  VisionPacket last_;bool have_=false;float cx_=0,cy_=0,area_=0,vx_=0,vy_=0,va_=0;
};
}
