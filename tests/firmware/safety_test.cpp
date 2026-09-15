#include "safety_controller.h"
#include "frame_guard.h"
#include <string>
#include <cassert>
#include <cstring>
#include <limits>
#include <iostream>
using namespace carerover;
void error(const char* actual, const char* expected) { assert(actual && std::strcmp(actual, expected) == 0); }
void zero(const SafetyController& s, uint64_t now) {
  const auto v = s.snapshot(now).target; assert(v.vx == 0 && v.vy == 0 && v.wz == 0);
}
SafetyController ready(uint64_t now = 10) { SafetyController s; s.network(true, now); s.cameraPacket(now); return s; }
int main() {
  {
    const std::string a=R"({"type":"ping","label":"[[[\""})";
    assert(boundedJsonText(a.c_str(),a.size()));
    const std::string deep(9,'['); assert(!boundedJsonText(deep.c_str(),deep.size()));
    const std::string huge(65537,' '); assert(!boundedJsonText(huge.c_str(),huge.size()));
    const char nul[]={'{','}',0,'{','}'}; assert(!boundedJsonText(nul,sizeof(nul)));
    assert(commandAgeAllowed(200)); assert(!commandAgeAllowed(201));
    assert(commandAgeAllowed(-100)); assert(!commandAgeAllowed(-101));
  }
  {
    auto s = ready(); assert(s.snapshot(10).mode == Mode::Idle); zero(s,10);
    error(s.velocity(1,1,0,0,10), "NOT_IN_MANUAL");
    assert(!s.setMode(1,Mode::Manual,10)); assert(!s.velocity(1,.5,-.4,.2,10));
    s.tick(249); assert(s.snapshot(249).target.vx == .5);
    s.tick(250); zero(s,250); assert(s.snapshot(250).mode == Mode::Idle);
    assert(std::strcmp(s.snapshot(250).stopReason,"watchdog") == 0);
    error(s.velocity(1,1,0,0,251), "NOT_IN_MANUAL");
  }
  {
    auto s = ready(); assert(!s.setMode(1,Mode::Manual,10)); assert(!s.velocity(1,1,0,0,10));
    error(s.velocity(1,std::numeric_limits<double>::quiet_NaN(),0,0,200), "INVALID_COMMAND");
    error(s.velocity(1,std::numeric_limits<double>::infinity(),0,0,200), "INVALID_COMMAND");
    error(s.velocity(1,1.01,0,0,200), "INVALID_COMMAND");
    error(s.velocity(2,1,0,0,220), "CONTROL_BUSY"); s.tick(250); zero(s,250);
    error(s.setMode(2,Mode::Manual,260), "CONTROL_BUSY");
    s.disconnect(2,270); assert(s.snapshot(270).owner == 1);
    s.disconnect(1,280); assert(s.snapshot(280).owner == 0);
    assert(!s.setMode(2,Mode::Manual,280));
  }
  {
    auto s = ready(); s.setMode(1,Mode::Manual,10); s.velocity(1,1,0,0,10);
    s.emergency(11); zero(s,11); assert(s.snapshot(11).estop);
    error(s.setMode(1,Mode::Health,12), "ESTOP_ACTIVE");
    error(s.velocity(1,1,0,0,12), "ESTOP_ACTIVE");
    error(s.clear(2,12), "CONTROL_BUSY");
    s.disconnect(1,13); assert(s.snapshot(13).estop);
    s.fault(true,14); error(s.clear(2,15), "FAULT_ACTIVE");
    s.fault(false,16); assert(s.snapshot(16).estop); assert(!s.clear(2,17));
    assert(s.snapshot(17).mode == Mode::Idle); assert(!s.snapshot(17).estop); zero(s,17);
  }
  {
    auto s = ready(520); assert(!s.setMode(1,Mode::Manual,900)); s.velocity(1,1,0,0,900);
    s.tick(1500); zero(s,1500); assert(s.snapshot(1500).mode == Mode::Idle);
    s.cameraPacket(1501); error(s.velocity(1,1,0,0,1502), "NOT_IN_MANUAL");
    s.setMode(1,Mode::Manual,1503); s.velocity(1,1,0,0,1503);
    s.network(false,1504); zero(s,1504); s.network(true,1505);
    error(s.velocity(1,1,0,0,1506), "NOT_IN_MANUAL");
    s.setMode(1,Mode::Manual,1507); s.velocity(1,1,0,0,1507);
    s.setMode(1,Mode::Health,1508); zero(s,1508);
  }
  {
    auto s = ready(0x100000000ULL); const uint64_t t = 0x100000000ULL;
    s.setMode(1,Mode::Manual,t); s.velocity(1,1,0,0,t); s.tick(t+240); zero(s,t+240);
  }
  // 20 independent failures, alternating disconnect, timeout, network loss, CAM loss.
  for (int i=0;i<20;++i) {
    auto s=ready(520); assert(!s.setMode(1,Mode::Manual,900)); s.velocity(1,.8,.1,0,900);
    if(i%4==0) s.disconnect(1,901);
    if(i%4==1) { s.cameraPacket(1100); s.tick(1140); }
    if(i%4==2) s.network(false,901);
    if(i%4==3) s.tick(1500);
    zero(s,1540);
  }
  std::cout << "Safety controller: all assertions passed, including 20 fault scenarios\n";
}
