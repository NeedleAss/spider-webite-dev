#pragma once
#include <cmath>
#include <cstdint>
namespace carerover {
struct ImuSample {
  float yaw=0,pitch=0,roll=0,gx=0,gy=0,gz=0,ax=0,ay=0,az=0;
  float biasX=0,biasY=0,biasZ=0;
  bool valid=false,calibrated=false,tiltFault=false;
  uint64_t sampleMs=0;
};
class ImuFilter {
 public:
  static constexpr float TiltFaultDeg=40.0f;
  static constexpr float TiltRecoverDeg=30.0f;
  static constexpr uint64_t TiltConfirmMs=200;
  static constexpr uint64_t TiltRecoveryMs=1000;
  void missing() { state_.valid=false; state_.tiltFault=true; tiltStart_=0; recoveryStart_=0; }
  const ImuSample& state() const { return state_; }
  void update(float ax,float ay,float az,float gx,float gy,float gz,uint64_t now) {
    if(!std::isfinite(ax+ay+az+gx+gy+gz)) { missing(); return; }
    float dt=last_&&now>=last_?float(now-last_)/1000:0.01f;
    if(dt>0.1f) { missing(); dt=0.01f; }
    last_=now;
    state_.ax=ax;state_.ay=ay;state_.az=az;state_.gx=gx;state_.gy=gy;state_.gz=gz;
    const float gravity=std::sqrt(ax*ax+ay*ay+az*az);
    const float pitch=std::atan2(-ax,std::sqrt(ay*ay+az*az))*57.2957795f;
    const float roll=std::atan2(ay,az)*57.2957795f;
    if(!state_.calibrated) {
      if(std::fabs(gravity-1)>0.08f||std::fabs(gx)>3||std::fabs(gy)>3||std::fabs(gz)>3) { calibrationStart_=0;count_=0;sx_=sy_=sz_=0; }
      else {
        if(!count_) calibrationStart_=now;
        ++count_; sx_+=gx;sy_+=gy;sz_+=gz;
        if(now-calibrationStart_>=5000&&count_>=450) { state_.biasX=sx_/count_;state_.biasY=sy_/count_;state_.biasZ=sz_/count_;state_.calibrated=true; }
      }
      state_.pitch=pitch;state_.roll=roll;
    } else {
      const float alpha=0.5f/(0.5f+dt);
      state_.roll=alpha*(state_.roll+(gx-state_.biasX)*dt)+(1-alpha)*roll;
      state_.pitch=alpha*(state_.pitch+(gy-state_.biasY)*dt)+(1-alpha)*pitch;
      state_.yaw+=(gz-state_.biasZ)*dt;
      if(state_.yaw>180) state_.yaw-=360;
      if(state_.yaw<-180) state_.yaw+=360;
    }
    state_.valid=true;state_.sampleMs=now;
    // Require a sustained large tilt. A single raw accelerometer spike is
    // expected when the chassis starts, stops, or crosses a small obstacle.
    const bool overTilt=std::fabs(pitch)>=TiltFaultDeg||std::fabs(roll)>=TiltFaultDeg||
                        std::fabs(state_.pitch)>=TiltFaultDeg||std::fabs(state_.roll)>=TiltFaultDeg;
    if(overTilt) {
      recoveryStart_=0;
      if(!tiltStart_) tiltStart_=now;
      if(now-tiltStart_>=TiltConfirmMs) state_.tiltFault=true;
    } else {
      tiltStart_=0;
    }
    if(state_.tiltFault) {
      if(std::fabs(pitch)<TiltRecoverDeg&&std::fabs(roll)<TiltRecoverDeg&&
         std::fabs(state_.pitch)<TiltRecoverDeg&&std::fabs(state_.roll)<TiltRecoverDeg) {
        if(!recoveryStart_) recoveryStart_=now;
        if(now-recoveryStart_>=TiltRecoveryMs) state_.tiltFault=false;
      } else recoveryStart_=0;
    }
  }
 private:
  ImuSample state_; uint64_t last_=0,calibrationStart_=0,tiltStart_=0,recoveryStart_=0;
  uint32_t count_=0;float sx_=0,sy_=0,sz_=0;
};
}
