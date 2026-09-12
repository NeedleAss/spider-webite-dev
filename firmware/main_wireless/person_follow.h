#pragma once
#include "vision_protocol.h"
#include <algorithm>
namespace carerover {
struct FollowVelocity { double vx=0, vy=0, wz=0; };
struct FollowConfig {
  float confidence=0.60f, ema=0.35f, deadzone=0.10f;
  float turnEnter=0.35f, turnExit=0.20f, distanceGain=0.5f, lateralGain=0.6f, turnGain=0.8f;
  float maxVx=0.25f, maxVy=0.20f, maxWz=0.30f, matchIou=0.10f;
};
class PersonFollowController {
 public:
  explicit PersonFollowController(FollowConfig cfg={}) : cfg_(cfg) {}
  void reset() { count_=0; initialized_=false; have_=false; lost_=false; turning_=false; reference_=ex_=area_=0; output_={}; }
  void update(const VisionPacket& p) {
    if(have_&&p.seq==previous_.seq) return;
    if(!p.found||p.score<float(1000)*cfg_.confidence) { output_={}; count_=0; lost_=initialized_; have_=false; return; }
    if(have_&&boxIou(previous_,p)<cfg_.matchIou) { output_={}; lost_=true; return; }
    previous_=p; have_=true;
    const float area=float((p.x1-p.x0)*(p.y1-p.y0));
    const float ex=(float(p.x0+p.x1)*0.5f-160.0f)/160.0f;
    if(!initialized_) {
      areas_[count_++]=area; ex_=ex; area_=area;
      if(count_<3) return;
      std::sort(areas_,areas_+3); reference_=areas_[1]; initialized_=true;
    } else { ex_+=cfg_.ema*(ex-ex_); area_+=cfg_.ema*(area-area_); }
    if(std::fabs(ex_)>=cfg_.turnEnter) turning_=true;
    else if(std::fabs(ex_)<=cfg_.turnExit) turning_=false;
    if(turning_) output_={0,0,limit(cfg_.turnGain*ex_,cfg_.maxWz)};
    else output_={limit(cfg_.distanceGain*dead(1-std::sqrt(area_/reference_)),cfg_.maxVx),limit(cfg_.lateralGain*dead(ex_),cfg_.maxVy),0};
  }
  FollowVelocity output() const { return lost_?FollowVelocity{}:output_; }
  bool ready() const { return initialized_&&!lost_; }
  bool lost() const { return lost_; }
  float referenceArea() const { return reference_; }
 private:
  float dead(float x) const { return std::fabs(x)<=cfg_.deadzone?0:x-std::copysign(cfg_.deadzone,x); }
  static float limit(float x,float max) { return std::max(-max,std::min(max,x)); }
  FollowConfig cfg_; VisionPacket previous_; int count_=0;
  bool initialized_=false, have_=false, lost_=false, turning_=false;
  float areas_[3]={}, ex_=0, area_=0, reference_=0; FollowVelocity output_;
};
}
