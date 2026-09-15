#pragma once
#include "vision_protocol.h"
#include <algorithm>
namespace carerover {
struct FollowVelocity { double vx=0, vy=0, wz=0; };
struct FollowConfig {
  float confidence=0.45f, ema=0.30f, centerDeadzone=0.07f, distanceDeadzone=0.08f;
  float distanceGain=0.55f, turnGain=0.75f;
  float maxVx=0.25f, maxWz=0.30f, matchIou=0.03f;
  // P results arrive at roughly 3.1-3.3 Hz in the combined stream.  Keep one
  // transient miss inside the 490 ms source deadline while commanding zero;
  // two consecutive misses still exceed this grace and latch target loss.
  uint64_t lossGraceMs=450;
};
class PersonFollowController {
 public:
  explicit PersonFollowController(FollowConfig cfg={}) : cfg_(cfg) {}
  void reset() { count_=0; initialized_=false; have_=false; lost_=false; reference_=ex_=area_=0;lastValidMs_=0;output_={}; }
  void update(const VisionPacket& p) {
    if(have_&&p.seq==previous_.seq) return;
    if(!p.found||p.score<float(1000)*cfg_.confidence) {
      output_={};
      if(initialized_&&lastValidMs_&&p.receivedMs>=lastValidMs_&&p.receivedMs-lastValidMs_>cfg_.lossGraceMs) lost_=true;
      return;
    }
    if(have_&&boxIou(previous_,p)<cfg_.matchIou) {
      output_={};
      if(lastValidMs_&&p.receivedMs>=lastValidMs_&&p.receivedMs-lastValidMs_>cfg_.lossGraceMs) lost_=true;
      return;
    }
    previous_=p; have_=true;
    lastValidMs_=p.receivedMs; lost_=false;
    const float area=float((p.x1-p.x0)*(p.y1-p.y0));
    const float ex=(float(p.x0+p.x1)*0.5f-160.0f)/160.0f;
    if(!initialized_) {
      areas_[count_++]=area; ex_=ex; area_=area;
      if(count_<3) return;
      std::sort(areas_,areas_+3); reference_=areas_[1]; initialized_=true;
    } else { ex_+=cfg_.ema*(ex-ex_); area_+=cfg_.ema*(area-area_); }
    const float distanceError=1-std::sqrt(area_/reference_);
    output_={limit(cfg_.distanceGain*dead(distanceError,cfg_.distanceDeadzone),cfg_.maxVx),
             0,
             limit(cfg_.turnGain*dead(ex_,cfg_.centerDeadzone),cfg_.maxWz)};
  }
  FollowVelocity output() const { return lost_?FollowVelocity{}:output_; }
  bool ready() const { return initialized_&&!lost_; }
  bool lost() const { return lost_; }
  float referenceArea() const { return reference_; }
 private:
  static float dead(float x,float zone) { return std::fabs(x)<=zone?0:x-std::copysign(zone,x); }
  static float limit(float x,float max) { return std::max(-max,std::min(max,x)); }
  FollowConfig cfg_; VisionPacket previous_; int count_=0;
  bool initialized_=false, have_=false, lost_=false;
  uint64_t lastValidMs_=0;
  float areas_[3]={}, ex_=0, area_=0, reference_=0; FollowVelocity output_;
};
}
