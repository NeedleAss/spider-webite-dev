#include "safety_controller.h"
#include "gesture_actions.h"
#include <cassert>
#include <cstring>
#include <iostream>
using namespace carerover;
SafetyController ready() {SafetyController s;s.network(true,10);s.cameraPacket(10);return s;}
bool zero(const SafetyController& s,uint64_t t) {const auto v=s.snapshot(t).target;return !v.vx&&!v.vy&&!v.wz;}
bool error(const char* actual,const char* expected) {return actual&&!std::strcmp(actual,expected);}
int main() {
  {auto s=ready();assert(!s.autonomousTurn(true,0,11));assert(s.snapshot(11).owner==0);assert(!zero(s,11));s.disconnect(22,12);assert(!zero(s,12));}
  {auto s=ready();s.setMode(1,Mode::Gesture,10);assert(s.snapshot(10).owner==0);assert(!s.autonomousTurn(true,0,11));}
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.2,0,0,11);
   assert(error(s.autonomousTurn(true,0,12),"CONTROL_BUSY"));assert(error(s.setMode(2,Mode::Manual,12),"CONTROL_BUSY"));
   s.velocity(1,0,0,0,13,true);assert(zero(s,13)&&s.snapshot(13).owner==0);assert(!s.autonomousTurn(true,0,14));
   s.velocity(1,0,0,0,15,true);assert(!zero(s,15));s.velocity(2,0,0,0,16,true);assert(!zero(s,16));
   s.velocity(1,0,0,0,17);s.updateGestureTurn(20,18);assert(zero(s,18));}
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.2,0,0,11);s.velocity(1,0,0,0,12,true);
   assert(!s.velocity(2,.1,0,0,13));assert(s.snapshot(13).owner==2);assert(error(s.velocity(1,.2,0,0,14),"CONTROL_BUSY"));}
  {auto s=ready();s.setMode(1,Mode::Manual,10);s.velocity(1,.2,0,0,11);s.tick(311);
   assert(zero(s,311));assert(error(s.autonomousTurn(true,0,312),"CONTROL_BUSY"));s.autonomousStop(313);assert(s.snapshot(313).owner==0);}
  {auto s=ready();s.setMode(1,Mode::Idle,10);assert(s.snapshot(10).owner==0);assert(!s.autonomousTurn(false,0,11));}
  {auto s=ready();s.setMode(1,Mode::Health,10);assert(error(s.autonomousTurn(true,0,11),"HEALTH_IN_PROGRESS"));
   s.setMode(1,Mode::Idle,12);assert(!s.autonomousTurn(true,0,13));}
  {auto s=ready();s.emergency(10);assert(error(s.autonomousTurn(true,0,11),"ESTOP_ACTIVE"));
   s.autonomousStop(12);assert(s.snapshot(12).estop);assert(!s.clear(1,13));assert(s.snapshot(13).owner==0&&zero(s,13));}
  {auto s=ready();assert(error(s.velocity(1,.2,0,0,11,true),"INVALID_COMMAND"));s.configureHardware(true,false);
   assert(error(s.autonomousTurn(true,0,12),"CALIBRATION_REQUIRED"));}
  {GestureRearmGate g;assert(g.observe(0,false,false,false));assert(!g.observe(1,true,false,false));
   assert(!g.observe(2,false,false,false));for(int i=0;i<20;++i)assert(!g.observe(2,false,false,false));
   assert(!g.observe(2,false,false,true));assert(!g.observe(2,false,false,true));assert(g.observe(2,false,false,true));
   g.acknowledge(3);assert(g.observe(3,false,false,false));assert(!g.observe(4,false,false,false));
   assert(!g.observe(4,false,true,true));assert(!g.observe(5,false,false,false));}
  {GestureRearmGate g;GestureActionLatch latch(4,3,tuning::balanced);g.observe(1,true,false,false);
   GestureAction action=GestureAction::None;for(unsigned i=0;i<4;++i)action=latch.update(true,"TWO",20+i*10);
   assert(action==GestureAction::TurnClockwise&&!g.observe(1,true,false,false));
   action=GestureAction::None;for(unsigned i=0;i<2;++i)action=latch.update(true,"DISLIKE",100+i*10);
   assert(action==GestureAction::Stop);}
  std::cout<<tuning::name<<": direct gestures, scoped releases, manual priority, re-arm and health/ESTOP gates PASS\n";
}
