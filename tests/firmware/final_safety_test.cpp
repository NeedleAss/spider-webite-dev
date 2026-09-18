#include "safety_controller.h"
#include "imu_filter.h"
#include <cmath>
#include <cstring>
#include <iostream>
using namespace carerover;
int failures=0, checks=0;
void check(bool ok,const char* name) { ++checks;if(!ok){++failures;std::cerr<<"FAIL "<<name<<'\n';} }
bool zero(const SafetyController& s,uint64_t t) { auto v=s.snapshot(t).target;return !v.vx&&!v.vy&&!v.wz; }
VisionPacket face(uint32_t seq,uint64_t t) {VisionPacket p;p.kind='P';p.seq=seq;p.receivedMs=t;p.found=true;p.score=900;p.x0=220;p.x1=300;p.y0=60;p.y1=140;return p;}
SafetyController ready() {SafetyController s;s.network(true,10);s.cameraPacket(10);return s;}
SafetyController following() {auto s=ready();s.person(face(1,10));s.autonomousFollow(10);s.person(face(2,20));s.computeFollow(20);return s;}
int main() {
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.5,0,0,10);
   s.heartbeat(1,309);s.tick(310);check(zero(s,310),"manual expiry clears output despite ping");check(s.snapshot(310).mode==Mode::Manual,"manual expiry retains mode");}
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.5,0,0,10);s.disconnect(2,20);check(!zero(s,20),"observer disconnect preserves owner");s.disconnect(1,21);check(zero(s,21)&&s.snapshot(21).owner==0,"owner disconnect cancels output");}
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.5,0,0,10);s.network(false,20);check(zero(s,20),"network down cancels output");s.network(true,21);check(zero(s,21),"network recovery cannot resume");}
  {auto s=following();check(!zero(s,20),"follow fixture moving");
   for(uint64_t t=100;t<=35000;t+=100){s.cameraPacket(t);s.computeFollow(t);if(t==1300)check(zero(s,t)&&s.snapshot(t).mode==Mode::Follow,"person silence zeros but retains follow");}
   check(zero(s,35000)&&s.snapshot(35000).mode==Mode::Idle,"silent target wait expires periodically");}
  {auto s=following();auto p=face(3,100);p.found=false;s.person(p);s.computeFollow(100);check(zero(s,100),"explicit no-person zeros immediately");s.person(face(4,200));s.computeFollow(200);check(!zero(s,200),"new real measurement restores follow");}
  {auto s=following();s.cameraPacket(400);s.tick(400);check(zero(s,400),"follow computation stall cancels output");}
  {auto s=ready();s.autonomousTurn(true,0,10);s.velocity(1,0,0,0,20);s.updateGestureTurn(20,30);check(zero(s,30),"ordinary stop cancels turn activity");}
  {auto s=ready();s.autonomousTurn(true,0,10);s.tick(15010);check(zero(s,15010)&&s.snapshot(15010).mode==Mode::Idle&&std::strcmp(s.snapshot(15010).stopReason,"gesture_turn_timeout")==0,"turn deadline does not require IMU callback");}
  {auto s=ready();s.configureHardware(true,true);s.imu(true,true,false,10);s.setMode(1,Mode::Manual,10);s.velocity(1,.5,0,0,10);s.imu(true,true,true,20);
   check(zero(s,20),"tilt stops immediately");check(s.setMode(1,Mode::Manual,21)!=nullptr,"tilt blocks readmission");s.imu(false,true,false,22);check(s.setMode(1,Mode::Manual,23)!=nullptr,"missing data cannot clear controller tilt");}
  {auto s=ready();s.configureHardware(true,true);s.imu(true,true,false,10);s.setMode(1,Mode::Manual,10);
   for(uint64_t t=100;t<=800;t+=100){s.cameraPacket(t);s.velocity(1,.5,0,0,t);}check(zero(s,800),"fresh commands cannot override expired IMU");}
  {auto s=ready();s.configureHardware(true,false);s.imu(true,true,false,10);check(s.setMode(1,Mode::Manual,10)!=nullptr,"unverified calibration rejects motion");}
  {ImuFilter f;for(uint64_t t=10;t<=500;t+=10)f.update(.5f,.866f,0,0,0,0,t);check(f.state().tiltFault,"tilt fixture latched");f.missing();check(f.state().tiltFault&&!f.state().valid,"missing preserves latched tilt");}
  {auto s=following();uint32_t seq=3;
   bool stayed=true;for(uint64_t t=30;t<=5000;t+=10){s.cameraPacket(t);if((t-20)%740==0)s.person(face(seq++,t));s.computeFollow(t);stayed&=s.snapshot(t).mode==Mode::Follow&&!s.snapshot(t).waitingTarget;}
   check(stayed,"1.35 FPS accepted real measurements keep follow active");}
  if(tuning::balanced){ImuFilter f;for(uint64_t t=10;t<=1000;t+=10){if(t%100==0)f.update(4,0,0,0,0,0,t);else f.update(.5f,.866f,0,0,0,0,t);}check(f.state().tiltFault,"intermittent rejected frames cannot erase sustained tilt");}
  std::cout<<tuning::name<<": "<<(checks-failures)<<"/"<<checks<<" checks passed\n";return failures?1:0;
}
