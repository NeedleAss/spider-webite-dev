#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
namespace carerover {
// All physical thresholds/times must come from the installed chassis calibration.
struct FrontConfig {
  bool enabled=false, verified=false, bypassVerified=false;
  double stopCm=0, slowCm=0, warnCm=0, releaseCm=0;
  double lateralSpeed=0, forwardSpeed=0;
  uint32_t settleMs=0, marginMs=0, passMs=0, lateralTimeoutMs=0;
  bool protectionReady() const {
    return enabled&&verified&&std::isfinite(stopCm)&&std::isfinite(slowCm)&&
      std::isfinite(warnCm)&&std::isfinite(releaseCm)&&stopCm>=2&&
      stopCm<slowCm&&slowCm<=warnCm&&slowCm<releaseCm&&releaseCm<=400&&warnCm<=400;
  }
  bool bypassReady() const {
    return protectionReady()&&bypassVerified&&std::isfinite(lateralSpeed)&&std::isfinite(forwardSpeed)&&
      lateralSpeed>0&&lateralSpeed<=.25&&forwardSpeed>0&&forwardSpeed<=.25&&
      settleMs>=70&&settleMs<=5000&&marginMs>0&&passMs>0&&
      lateralTimeoutMs>marginMs&&lateralTimeoutMs<=30000&&passMs<=30000;
  }
};
enum class BypassPhase { None, Halt, Right, Margin, Pass, Reacquire };
inline const char* phaseName(BypassPhase p) {
  switch(p) { case BypassPhase::Halt:return "HALT";case BypassPhase::Right:return "RIGHT";
    case BypassPhase::Margin:return "MARGIN";case BypassPhase::Pass:return "PASS";
    case BypassPhase::Reacquire:return "REACQUIRE";default:return "NONE"; }
}
struct FrontSnapshot {
  bool enabled=false, ready=false, valid=false, demoReady=false, demoEnabled=false, held=false;
  double distanceCm=0, rawCm=0; uint64_t ageMs=0;
  BypassPhase phase=BypassPhase::None;
  const char* status="DISABLED";
};
struct FrontVelocity { double vx=0,vy=0,wz=0; };
class FrontGuard {
 public:
  static constexpr uint64_t StaleMs=220;
  void configure(FrontConfig cfg) { *this=FrontGuard{};cfg_=cfg; }
  const FrontConfig& config() const { return cfg_; }
  void sample(double cm,bool valid,uint64_t now) {
    if(seen_&&now<=sampleMs_) return; // Duplicate samples never renew freshness/counts.
    seen_=true;sampleMs_=now;valid_=valid&&std::isfinite(cm)&&cm>=2&&cm<=400;
    if(!valid_) { count_=near_=clear_=0;index_=0;return; }
    raw_=cm;values_[index_++%3]=cm;count_=std::min(count_+1,3);
    double sorted[3];std::copy(values_,values_+count_,sorted);std::sort(sorted,sorted+count_);
    distance_=sorted[count_/2];
    near_=cm<=cfg_.stopCm?std::min(near_+1,3):0;
    clear_=cm>=cfg_.releaseCm?std::min(clear_+1,3):0;
    if(cm<=cfg_.stopCm)blocked_=true;else if(clear_>=3)blocked_=false;
  }
  bool fresh(uint64_t now) const { return seen_&&valid_&&now>=sampleMs_&&now-sampleMs_<StaleMs; }
  FrontSnapshot snapshot(uint64_t now) const {
    FrontSnapshot s; s.enabled=cfg_.enabled;s.ready=cfg_.protectionReady();s.valid=fresh(now);
    s.demoReady=cfg_.bypassReady();s.demoEnabled=demo_;s.held=held_;s.phase=phase_;
    s.distanceCm=s.valid?distance_:0;s.rawCm=s.valid?raw_:0;s.ageMs=seen_&&now>=sampleMs_?now-sampleMs_:StaleMs;
    s.status=!cfg_.enabled?"DISABLED":!s.ready?"UNCONFIGURED":!s.valid?"UNKNOWN":held_?"STOPPED":
      phase_!=BypassPhase::None?"BYPASS":blocked_?"BLOCKED":
      std::min(raw_,distance_)<cfg_.slowCm?"SLOW":distance_<cfg_.warnCm?"WARN":"CLEAR";
    return s;
  }
  bool setDemo(bool enabled) { if(enabled&&!cfg_.bypassReady())return false;demo_=enabled;return true; }
  bool active() const { return phase_!=BypassPhase::None; }
  BypassPhase phase() const { return phase_; }
  void cancel() { phase_=BypassPhase::None;demo_=false; }
  void release() { held_=false; }
  void hold() { held_=true; }
  bool held() const { return held_; }
  bool blocked() const { return blocked_; }
  // Returns a reason requiring the existing safety controller to cancel autonomous motion.
  const char* advance(uint64_t now,bool following,bool approaching,bool targetReady) {
    if(!cfg_.enabled)return nullptr;
    if(!cfg_.protectionReady())return "front_unconfigured";
    if(!fresh(now))return "front_unknown";
    if(!following)return nullptr;
    if(phase_==BypassPhase::None && approaching && blocked_) {
      if(!demo_||raw_>cfg_.stopCm)return "front_obstacle";
      enter(BypassPhase::Halt,now);
    }
    if(phase_==BypassPhase::Halt) {
      if(now-phaseMs_>=3000)return "front_unstable";
      if(near_>=3&&now-phaseMs_>=cfg_.settleMs) { enter(BypassPhase::Right,now);lateralMs_=now;clear_=0; }
    } else if(phase_==BypassPhase::Right||phase_==BypassPhase::Margin) {
      if(now-lateralMs_>=cfg_.lateralTimeoutMs)return "bypass_timeout";
      if(phase_==BypassPhase::Right&&clear_>=3)enter(BypassPhase::Margin,now);
      else if(phase_==BypassPhase::Margin) {
        if(raw_<cfg_.releaseCm) { enter(BypassPhase::Right,now);clear_=0; }
        else if(now-phaseMs_>=cfg_.marginMs)enter(BypassPhase::Pass,now);
      }
    } else if(phase_==BypassPhase::Pass) {
      if(raw_<cfg_.slowCm)return "bypass_blocked";
      if(now-phaseMs_>=cfg_.passMs)enter(BypassPhase::Reacquire,now);
    } else if(phase_==BypassPhase::Reacquire) {
      if(now-phaseMs_>=3000)return "target_reacquire_timeout";
      if(targetReady) { phase_=BypassPhase::None;demo_=false; } // One explicit demo per enable.
    }
    return nullptr;
  }
  FrontVelocity output(FrontVelocity desired,uint64_t now) const {
    if(!cfg_.enabled)return desired;
    if(!cfg_.protectionReady()||!fresh(now)||held_)return {};
    if(phase_==BypassPhase::Halt||phase_==BypassPhase::Reacquire)return {};
    if(phase_==BypassPhase::Right||phase_==BypassPhase::Margin)return {0,cfg_.lateralSpeed,0};
    if(phase_==BypassPhase::Pass)return {cfg_.forwardSpeed,0,0};
    if(desired.vx>0) {
      if(blocked_)return {};
      const auto factor=std::clamp((std::min(raw_,distance_)-cfg_.stopCm)/(cfg_.slowCm-cfg_.stopCm),0.0,1.0);
      desired.vx*=factor;
    }
    return desired;
  }
 private:
  void enter(BypassPhase phase,uint64_t now) { phase_=phase;phaseMs_=now; }
  FrontConfig cfg_;bool seen_=false,valid_=false,demo_=false,held_=false,blocked_=false;
  uint64_t sampleMs_=0,phaseMs_=0,lateralMs_=0;double raw_=0,distance_=0,values_[3]={};
  unsigned index_=0;int count_=0,near_=0,clear_=0;BypassPhase phase_=BypassPhase::None;
};
}
