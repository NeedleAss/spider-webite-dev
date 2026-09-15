#pragma once
#include <cmath>
#include <cstdint>
#include "person_follow.h"
namespace carerover {
enum class Mode { Idle, Manual, Health, Follow, Gesture };
inline const char* modeName(Mode m) { return m==Mode::Manual?"MANUAL":m==Mode::Health?"HEALTH_CHECK":m==Mode::Follow?"PERSON_FOLLOW":m==Mode::Gesture?"GESTURE_CONTROL":"IDLE"; }
struct Targets { double vx=0, vy=0, wz=0; };
struct SafetySnapshot {
  Mode mode=Mode::Idle; Targets target;
  bool estop=false, fault=false, camera=false, network=false;
  uint32_t owner=0, stopSequence=0;
  uint64_t lastCommandMs=0, stoppedAtMs=0;
  const char* stopReason="boot";
};
class SafetyController {
 public:
  static constexpr uint64_t CommandExpiryMs=240, CameraExpiryMs=490, PersonExpiryMs=490;
  static constexpr uint16_t PersonAcceptScoreMilli=450;
  static constexpr uint64_t GestureTurnTimeoutMs=12000;
  SafetySnapshot snapshot(uint64_t now) const {
    auto s=state_; s.camera=cameraSeen_&&now>=lastCameraMs_&&now-lastCameraMs_<CameraExpiryMs;
    s.fault=state_.fault||(hardware_&&!hardwareHealthy(now)); return s;
  }
  void configureHardware(bool enabled, bool calibrated) { hardware_=enabled; calibration_=calibrated; }
  void imu(bool valid, bool calibrated, bool tilt, uint64_t now) {
    imuValid_=valid&&calibrated&&!tilt; lastImuMs_=now;
    if(hardware_&&!imuValid_&&(state_.mode==Mode::Manual||state_.mode==Mode::Follow)) stop(now,tilt?"tilt_fault":"imu_invalid");
  }
  void cameraPacket(uint64_t now) { cameraSeen_=true; lastCameraMs_=now; }
  void cameraReset(uint64_t now) { personSeen_=false; stop(now,"camera_resync"); }
  void person(const VisionPacket& p) {
    person_=p; personSeen_=true;
    if(state_.mode==Mode::Follow) {
      follow_.update(p);
      if(follow_.lost()) { stop(p.receivedMs,"target_lost"); }
    }
  }
  void heartbeat(uint32_t client,uint64_t now) {
    if(state_.mode==Mode::Follow&&client==state_.owner) heartbeatMs_=now;
  }
  // Only the controller task may refresh this output lease; ping never does.
  void computeFollow(uint64_t now) {
    tick(now); if(state_.mode!=Mode::Follow) return;
    auto v=follow_.output(); state_.target={v.vx,v.vy,v.wz}; state_.lastCommandMs=now; armed_=true;
  }
  float followReference() const { return follow_.referenceArea(); }
  bool followingReady() const { return follow_.ready(); }
  const char* autonomousFollow(uint64_t now) {
    tick(now);
    if(state_.estop) return "ESTOP_ACTIVE";
    if(state_.fault||!state_.network) return "FAULT_ACTIVE";
    if(state_.owner && (state_.mode==Mode::Manual||state_.mode==Mode::Health)) return "CONTROL_BUSY";
    if(!snapshot(now).camera) return "CAMERA_OFFLINE";
    if(hardware_&&!calibration_) return "CALIBRATION_REQUIRED";
    if(hardware_&&!hardwareHealthy(now)) return "IMU_NOT_READY";
    if(!personFresh(now)||!person_.found||person_.score<PersonAcceptScoreMilli) return "TARGET_NOT_READY";
    state_.owner=0; stop(now,"gesture_like"); state_.mode=Mode::Follow;
    state_.lastCommandMs=now; armed_=true;
    return nullptr;
  }
  const char* autonomousTurn(bool clockwise,float yaw,uint64_t now) {
    tick(now);
    if(state_.estop) return "ESTOP_ACTIVE";
    if(state_.fault||!state_.network) return "FAULT_ACTIVE";
    if(state_.owner && (state_.mode==Mode::Manual||state_.mode==Mode::Health)) return "CONTROL_BUSY";
    if(!snapshot(now).camera) return "CAMERA_OFFLINE";
    if(hardware_&&!calibration_) return "CALIBRATION_REQUIRED";
    if(hardware_&&!hardwareHealthy(now)) return "IMU_NOT_READY";
    state_.owner=0; stop(now,clockwise?"gesture_two":"gesture_ok"); state_.mode=Mode::Gesture;
    turnClockwise_=clockwise; turnAccumDeg_=0; turnLastYaw_=yaw; turnStartMs_=now;
    state_.target={0,0,clockwise?0.28:-0.28}; state_.lastCommandMs=now; armed_=true;
    return nullptr;
  }
  void updateGestureTurn(float yaw,uint64_t now) {
    if(state_.mode!=Mode::Gesture) return;
    float delta=yaw-turnLastYaw_;
    if(delta>180) delta-=360;
    if(delta<-180) delta+=360;
    turnLastYaw_=yaw; turnAccumDeg_+=std::fabs(delta);
    if(turnAccumDeg_>=360.0f) { state_.owner=0; stop(now,"gesture_turn_complete"); return; }
    if(now-turnStartMs_>=GestureTurnTimeoutMs) { state_.owner=0; stop(now,"gesture_turn_timeout"); return; }
    const double speed=turnAccumDeg_>=300.0f?0.18:0.28;
    state_.target={0,0,turnClockwise_?speed:-speed}; state_.lastCommandMs=now; armed_=true;
  }
  void autonomousStop(uint64_t now,const char* reason="gesture_dislike") {
    state_.owner=0; stop(now,reason);
  }
  float gestureTurnDegrees() const { return turnAccumDeg_; }
  void network(bool online,uint64_t now) { state_.network=online; if(!online) stop(now,"network_down"); }
  void fault(bool active,uint64_t now) { state_.fault=active; if(active) stop(now,"fault"); }
  void disconnect(uint32_t client,uint64_t now) { if(client&&state_.owner==client) { stop(now,"owner_disconnected"); state_.owner=0; } }
  void emergency(uint64_t now) { state_.estop=true; stop(now,"estop"); }
  const char* clear(uint32_t client,uint64_t now) {
    if(!client) return "INVALID_COMMAND";
    if(state_.fault||!state_.network||(hardware_&&!hardwareHealthy(now))) return "FAULT_ACTIVE";
    if(busy(client)) return "CONTROL_BUSY";
    state_.owner=client; state_.estop=false; stop(now,"estop_cleared"); return nullptr;
  }
  const char* setMode(uint32_t client,Mode mode,uint64_t now) {
    tick(now);
    if(!client) return "INVALID_COMMAND";
    if(state_.estop) return "ESTOP_ACTIVE";
    if(state_.fault||!state_.network) return "FAULT_ACTIVE";
    if(busy(client)) return "CONTROL_BUSY";
    const bool movement=mode==Mode::Manual||mode==Mode::Follow||mode==Mode::Gesture;
    if(movement&&!snapshot(now).camera) return "CAMERA_OFFLINE";
    if(movement&&hardware_&&!calibration_) return "CALIBRATION_REQUIRED";
    if(movement&&hardware_&&!hardwareHealthy(now)) return "IMU_NOT_READY";
    if(mode==Mode::Follow&&(!personFresh(now)||!person_.found||person_.score<PersonAcceptScoreMilli)) return "TARGET_NOT_READY";
    state_.owner=client; stop(now,"mode_changed"); state_.mode=mode;
    if(mode==Mode::Follow) { heartbeatMs_=now; state_.lastCommandMs=now; armed_=true; }
    return nullptr;
  }
  const char* velocity(uint32_t client,double vx,double vy,double wz,uint64_t now) {
    tick(now);
    if(!valid(vx)||!valid(vy)||!valid(wz)||!client) return "INVALID_COMMAND";
    if(busy(client)) return "CONTROL_BUSY";
    if(vx==0&&vy==0&&wz==0) {
      const bool wasActive=armed_||state_.target.vx||state_.target.vy||state_.target.wz;
      state_.target={}; armed_=false;
      if(state_.mode==Mode::Follow) stop(now,"release");
      else if(wasActive) { state_.stoppedAtMs=now; state_.stopReason="release"; ++state_.stopSequence; }
      return nullptr;
    }
    if(state_.estop) return "ESTOP_ACTIVE";
    if(state_.fault||!state_.network||(hardware_&&!hardwareHealthy(now))) return "FAULT_ACTIVE";
    if(state_.mode!=Mode::Manual||state_.owner!=client) return "NOT_IN_MANUAL";
    if(!snapshot(now).camera) return "CAMERA_OFFLINE";
    state_.target={vx,vy,wz}; state_.lastCommandMs=now; armed_=true; return nullptr;
  }
  void tick(uint64_t now) {
    const bool movingMode=state_.mode==Mode::Manual||state_.mode==Mode::Follow||state_.mode==Mode::Gesture;
    if(movingMode&&hardware_&&!hardwareHealthy(now)) { stop(now,"imu_timeout"); return; }
    if(movingMode&&!snapshot(now).camera) { stop(now,"camera_timeout"); return; }
    if(state_.mode==Mode::Follow) {
      if(!personFresh(now)) { stop(now,"person_timeout"); return; }
      if(state_.owner&&now-heartbeatMs_>=CommandExpiryMs) { stop(now,"owner_watchdog"); return; }
    }
    if(armed_&&now-state_.lastCommandMs>=CommandExpiryMs) stop(now,"watchdog");
  }
  void stop(uint64_t now,const char* reason) {
    state_.target={}; state_.mode=Mode::Idle; armed_=false; follow_.reset();
    state_.stoppedAtMs=now; state_.stopReason=reason; ++state_.stopSequence;
  }
 private:
  static bool valid(double v) { return std::isfinite(v)&&v>=-1&&v<=1; }
  bool busy(uint32_t client) const { return state_.owner&&state_.owner!=client; }
  bool hardwareHealthy(uint64_t now) const { return imuValid_&&now>=lastImuMs_&&now-lastImuMs_<100; }
  bool personFresh(uint64_t now) const { return personSeen_&&now>=person_.receivedMs&&now-person_.receivedMs<PersonExpiryMs; }
  SafetySnapshot state_; PersonFollowController follow_; VisionPacket person_;
  uint64_t lastCameraMs_=0,lastImuMs_=0,heartbeatMs_=0;
  bool cameraSeen_=false,armed_=false,hardware_=false,calibration_=false,imuValid_=false,personSeen_=false;
  bool turnClockwise_=true;
  float turnAccumDeg_=0,turnLastYaw_=0;
  uint64_t turnStartMs_=0;
};
}
