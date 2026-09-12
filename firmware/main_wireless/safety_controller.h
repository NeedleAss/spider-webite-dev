#pragma once
#include <cmath>
#include <cstdint>
#include "person_follow.h"
#include "front_guard.h"
namespace carerover {
enum class Mode { Idle, Manual, Health, Follow };
inline const char* modeName(Mode m) { return m==Mode::Manual?"MANUAL":m==Mode::Health?"HEALTH_CHECK":m==Mode::Follow?"PERSON_FOLLOW":"IDLE"; }
struct Targets { double vx=0, vy=0, wz=0; };
struct SafetySnapshot {
  Mode mode=Mode::Idle; Targets target; FrontSnapshot front;
  bool estop=false, fault=false, camera=false, network=false;
  uint32_t owner=0, stopSequence=0;
  uint64_t lastCommandMs=0, stoppedAtMs=0;
  const char* stopReason="boot";
};
class SafetyController {
 public:
  static constexpr uint64_t CommandExpiryMs=240, CameraExpiryMs=490, PersonExpiryMs=490;
  SafetySnapshot snapshot(uint64_t now) const {
    auto s=state_; s.camera=cameraSeen_&&now>=lastCameraMs_&&now-lastCameraMs_<CameraExpiryMs;
    s.fault=state_.fault||(hardware_&&!hardwareHealthy(now));
    s.front=front_.snapshot(now);
    if(state_.mode==Mode::Manual||state_.mode==Mode::Follow) {
      auto v=front_.output({s.target.vx,s.target.vy,s.target.wz},now);s.target={v.vx,v.vy,v.wz};
    }
    return s;
  }
  void configureFront(FrontConfig cfg) { front_.configure(cfg); }
  void frontSample(double cm,bool valid,uint64_t now) { front_.sample(cm,valid,now);tick(now); }
  const char* demo(uint32_t client,bool enabled,uint64_t now) {
    tick(now);
    if(!client)return "INVALID_COMMAND";
    if(busy(client))return "CONTROL_BUSY";
    if(state_.estop)return "ESTOP_ACTIVE";
    if(state_.mode!=Mode::Follow||state_.owner!=client)return "NOT_IN_FOLLOW";
    if(!enabled&&front_.active()) { stop(now,"bypass_disabled");return nullptr; }
    return front_.setDemo(enabled)?nullptr:"BYPASS_CALIBRATION_REQUIRED";
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
      if(!p.found || p.score<600 || follow_.lost()) { stop(p.receivedMs,"target_lost"); }
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
    const bool movement=mode==Mode::Manual||mode==Mode::Follow;
    if(movement&&front_.held())return "FRONT_RELEASE_REQUIRED";
    if(movement&&front_.config().enabled&&!front_.config().protectionReady())return "FRONT_CALIBRATION_REQUIRED";
    if(movement&&front_.config().enabled&&!front_.fresh(now))return "FRONT_UNKNOWN";
    if(movement&&!snapshot(now).camera) return "CAMERA_OFFLINE";
    if(movement&&hardware_&&!calibration_) return "CALIBRATION_REQUIRED";
    if(movement&&hardware_&&!hardwareHealthy(now)) return "IMU_NOT_READY";
    if(mode==Mode::Follow&&(!personFresh(now)||!person_.found||person_.score<600)) return "TARGET_NOT_READY";
    state_.owner=client; stop(now,"mode_changed"); state_.mode=mode;
    if(mode==Mode::Follow) { heartbeatMs_=now; state_.lastCommandMs=now; armed_=true; }
    return nullptr;
  }
  const char* velocity(uint32_t client,double vx,double vy,double wz,uint64_t now) {
    tick(now);
    if(!valid(vx)||!valid(vy)||!valid(wz)||!client) return "INVALID_COMMAND";
    if(busy(client)) return "CONTROL_BUSY";
    if(vx==0&&vy==0&&wz==0) {
      front_.release();
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
    if(front_.held())return "FRONT_RELEASE_REQUIRED";
    if(front_.config().enabled&&(!front_.fresh(now)||!front_.config().protectionReady()))return "FRONT_UNKNOWN";
    state_.target={vx,vy,wz}; state_.lastCommandMs=now; armed_=true; tick(now);return nullptr;
  }
  void tick(uint64_t now) {
    const bool movingMode=state_.mode==Mode::Manual||state_.mode==Mode::Follow;
    if(movingMode&&hardware_&&!hardwareHealthy(now)) { stop(now,"imu_timeout"); return; }
    if(movingMode&&!snapshot(now).camera) { stop(now,"camera_timeout"); return; }
    if(state_.mode==Mode::Follow) {
      if(!personFresh(now)) { stop(now,"person_timeout"); return; }
      if(now-heartbeatMs_>=CommandExpiryMs) { stop(now,"owner_watchdog"); return; }
    }
    if(armed_&&now-state_.lastCommandMs>=CommandExpiryMs) { stop(now,"watchdog");return; }
    if(movingMode) {
      const auto before=front_.phase();
      auto reason=front_.advance(now,state_.mode==Mode::Follow,state_.target.vx>0,follow_.ready());
      if(before==BypassPhase::None&&front_.phase()==BypassPhase::Halt) {
        state_.stopReason="front_obstacle";state_.stoppedAtMs=now;++state_.stopSequence;
      }
      if(before!=BypassPhase::Reacquire&&front_.phase()==BypassPhase::Reacquire) {
        follow_.reset();state_.stopReason="bypass_pass_complete";state_.stoppedAtMs=now;++state_.stopSequence;
      }
      if(reason) { stop(now,reason);return; }
      if(state_.mode==Mode::Manual&&state_.target.vx>0&&front_.config().enabled&&front_.blocked()) {
        state_.target={};armed_=false;front_.hold();state_.stopReason="front_obstacle";state_.stoppedAtMs=now;++state_.stopSequence;
      }
    }
  }
  void stop(uint64_t now,const char* reason) {
    state_.target={}; state_.mode=Mode::Idle; armed_=false; follow_.reset();front_.cancel();
    state_.stoppedAtMs=now; state_.stopReason=reason; ++state_.stopSequence;
  }
 private:
  static bool valid(double v) { return std::isfinite(v)&&v>=-1&&v<=1; }
  bool busy(uint32_t client) const { return state_.owner&&state_.owner!=client; }
  bool hardwareHealthy(uint64_t now) const { return imuValid_&&now>=lastImuMs_&&now-lastImuMs_<100; }
  bool personFresh(uint64_t now) const { return personSeen_&&now>=person_.receivedMs&&now-person_.receivedMs<PersonExpiryMs; }
  SafetySnapshot state_; FrontGuard front_; PersonFollowController follow_; VisionPacket person_;
  uint64_t lastCameraMs_=0,lastImuMs_=0,heartbeatMs_=0;
  bool cameraSeen_=false,armed_=false,hardware_=false,calibration_=false,imuValid_=false,personSeen_=false;
};
}
