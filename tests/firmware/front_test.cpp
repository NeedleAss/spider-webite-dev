#include "safety_controller.h"
#include "front_config.h"
#include <cassert>
#include <cstring>
#include <iostream>
#include <limits>
using namespace carerover;
// Synthetic test fixtures, not physical calibration.
FrontConfig config() { FrontConfig c;c.enabled=c.verified=c.bypassVerified=true;c.stopCm=20;c.slowCm=50;c.warnCm=60;c.releaseCm=70;c.lateralSpeed=.15;c.forwardSpeed=.15;c.settleMs=140;c.marginMs=210;c.passMs=280;c.lateralTimeoutMs=1400;return c; }
VisionPacket face(uint64_t t) { VisionPacket p;p.kind='P';p.seq=t+1;p.receivedMs=t;p.found=true;p.score=900;p.x0=120;p.x1=200;p.y0=60;p.y1=160;return p; }
void zero(SafetyController& s,uint64_t t) { const auto v=s.snapshot(t).target;assert(!v.vx&&!v.vy&&!v.wz); }
void feed(SafetyController& s,uint64_t t,double cm=120) {s.imu(true,true,false,t);s.cameraPacket(t);s.heartbeat(1,t);s.person(face(t));s.frontSample(cm,true,t);s.computeFollow(t);}
int main() {
  auto cfg=config();assert(cfg.protectionReady()&&cfg.bypassReady());
  {auto c=cfg;c.stopCm=std::numeric_limits<double>::quiet_NaN();assert(!c.protectionReady());c=cfg;c.passMs=0;assert(!c.bypassReady());c=cfg;c.releaseCm=40;assert(!c.protectionReady());}
  assert(!frontPinAllowed(17)&&!frontPinAllowed(18)&&!frontPinAllowed(10)&&!frontPinAllowed(35));
  { FrontGuard g;g.configure(cfg);g.sample(120,true,1);g.sample(120,true,71);g.sample(5,true,141);
    assert(g.snapshot(141).distanceCm==120);assert(g.output({1,0,0},141).vx==0); // raw beats median
    g.sample(0,false,211);assert(!g.snapshot(211).valid);g.sample(40,true,281);assert(g.snapshot(281).distanceCm==40);
    assert(g.output({1,0,0},281).vx==0);assert(!g.fresh(501));g.sample(120,true,281);assert(!g.fresh(501));
  }
  { SafetyController s;s.configureFront(cfg);s.network(true,1);s.cameraPacket(1);
    assert(s.setMode(1,Mode::Manual,1));s.frontSample(120,true,2);assert(!s.setMode(1,Mode::Manual,2));
    assert(!s.velocity(1,.8,.2,0,3));s.frontSample(10,true,72);zero(s,72);assert(s.snapshot(72).front.held);
    s.frontSample(120,true,142);assert(s.velocity(1,.8,0,0,143));zero(s,143);
    s.frontSample(120,true,212);s.frontSample(120,true,282);
    assert(!s.velocity(1,0,0,0,284));assert(!s.velocity(1,.8,0,0,285));assert(s.snapshot(285).target.vx>0);
    s.frontSample(0,false,352);zero(s,352);assert(s.snapshot(352).mode==Mode::Idle);
    s.frontSample(120,true,422);zero(s,422); // no automatic resume
  }
  { SafetyController s;s.configureFront(cfg);s.network(true,1);feed(s,1);assert(!s.setMode(1,Mode::Follow,1));
    for(uint64_t t=71;t<=211;t+=70)feed(s,t);
    assert(s.followingReady());assert(!s.demo(1,true,212));assert(s.demo(2,true,212));
    // Shrink the face over matched frames to request forward movement.
    auto p=face(213);p.x0=140;p.x1=180;p.y0=80;p.y1=140;s.person(p);s.computeFollow(213);
    assert(s.snapshot(213).target.vx>0);
    feed(s,281,18);assert(s.snapshot(281).stoppedAtMs==281);assert(std::strcmp(s.snapshot(281).stopReason,"front_obstacle")==0);assert(s.snapshot(281).front.phase==BypassPhase::Halt);zero(s,281);
    feed(s,351,18);feed(s,421,18);assert(s.snapshot(421).front.phase==BypassPhase::Right);assert(s.snapshot(421).target.vy>0);
    feed(s,491,120);feed(s,561,120);feed(s,631,120);assert(s.snapshot(631).front.phase==BypassPhase::Margin);
    feed(s,701);feed(s,771);feed(s,841);assert(s.snapshot(841).front.phase==BypassPhase::Pass);assert(s.snapshot(841).target.vx>0&&s.snapshot(841).target.vy==0);
    for(uint64_t t=911;t<=1121;t+=70)feed(s,t);
    assert(s.snapshot(1121).front.phase==BypassPhase::Reacquire);zero(s,1121);assert(!s.followingReady());
    feed(s,1191);feed(s,1261);zero(s,1261);feed(s,1331);
    assert(s.snapshot(1331).front.phase==BypassPhase::None);assert(s.followingReady());assert(!s.snapshot(1331).front.demoEnabled);
  }
  // Exercise every bypass phase against independent existing stop paths.
  for(auto phase:{BypassPhase::Halt,BypassPhase::Right,BypassPhase::Margin,BypassPhase::Pass,BypassPhase::Reacquire}) {
    for(int fault=0;fault<8;++fault) {
      SafetyController s;s.configureHardware(true,true);s.configureFront(cfg);s.network(true,1);feed(s,1);s.setMode(1,Mode::Follow,1);
      feed(s,71);feed(s,141);feed(s,211);s.demo(1,true,212);
      auto p=face(213);p.x0=140;p.x1=180;p.y0=80;p.y1=140;s.person(p);s.computeFollow(213);
      uint64_t t=281;for(;t<1400;t+=70){feed(s,t,t<=421?18:120);if(s.snapshot(t).front.phase==phase)break;}
      assert(t<1400);
      if(fault==0)s.emergency(t+1);
      if(fault==1)s.disconnect(1,t+1);
      if(fault==2){auto p=face(t+1);p.found=false;s.person(p);}
      if(fault==3)s.fault(true,t+1);
      if(fault==4)s.frontSample(0,false,t+1);
      if(fault==5)s.network(false,t+1);
      if(fault==6) { s.imu(false,false,false,t+1); s.tick(t+250); }
      if(fault==7) {s.imu(true,true,false,t+240);s.cameraPacket(t+240);s.person(face(t+240));s.frontSample(120,true,t+240);s.tick(t+240);assert(std::strcmp(s.snapshot(t+240).stopReason,"owner_watchdog")==0);}
      zero(s,t+1);assert(s.snapshot(t+1).mode==Mode::Idle);assert(!s.snapshot(t+1).front.demoEnabled);
    }
  }
  {FrontGuard g;g.configure(cfg);g.setDemo(true);uint64_t t=1;for(;t<=141;t+=70){g.sample(18,true,t);assert(!g.advance(t,true,true,true));}
    assert(g.phase()==BypassPhase::Right);const char* reason=nullptr;
    for(;t<1700&&!reason;t+=70){g.sample(18,true,t);reason=g.advance(t,true,true,true);}
    assert(reason&&std::strcmp(reason,"bypass_timeout")==0);
  }
  { FrontGuard g;g.configure(cfg);g.setDemo(true);
    for(uint64_t t=1;t<=141;t+=70){g.sample(18,true,t);g.advance(t,true,true,true);}
    for(uint64_t t=211;t<=561;t+=70){g.sample(120,true,t);g.advance(t,true,true,true);}
    assert(g.phase()==BypassPhase::Pass);g.sample(30,true,631);
    assert(std::strcmp(g.advance(631,true,true,true),"bypass_blocked")==0);
  }
  { SafetyController s;s.configureFront(cfg);s.network(true,1);feed(s,1);s.setMode(1,Mode::Manual,1);s.velocity(1,.5,0,0,1);
    s.cameraPacket(221);s.tick(221);zero(s,221);assert(std::strcmp(s.snapshot(221).stopReason,"front_unknown")==0);
  }
  std::cout<<"Front protection: raw stop, filter, freshness, release latch, full bypass and 40 fault/phase cases passed\n";
}
