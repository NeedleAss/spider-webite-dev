#include "demo_signal_filters.h"
#include "demo_ppg.h"
#include "imu_filter.h"
#include "gesture_actions.h"
#include "safety_controller.h"
#include <cassert>
#include <cstring>
#include <iostream>
using namespace carerover;
int main(){
  GestureDisplay g(350,180,2,2,8,4);
  g.update(true,"LIKE",480,100);g.update(true,"LIKE",120,400);g.update(true,"LIKE",460,700);
  if(tuning::balanced){assert(g.accepted()&&!g.holding());g.update(true,"no_gesture",0,1000);assert(g.accepted()&&g.holding());g.update(false,"no_hand",0,1100);g.update(false,"no_hand",0,2800);assert(!g.accepted());}
  else assert(!g.accepted());
  GestureActionLatch action(4,3,true);
  assert(action.update(true,"LIKE",100)==GestureAction::None);
  action.update(false,"LIKE",400);action.update(true,"LIKE",700);
  assert(action.update(true,"LIKE",1000)==GestureAction::StartFollow);
  assert(action.update(true,"LIKE",1300)==GestureAction::None);
  GestureActionLatch stale(4,3,true);stale.update(true,"LIKE",1);stale.update(true,"LIKE",100);
  assert(stale.update(true,"LIKE",2000)==GestureAction::None);
  TimedMetric hr(30000,12,4);hr.update(false,90,0,0);assert(!hr.valid());
  hr.update(true,72,.8,1000);hr.update(false,0,0,1500);hr.update(true,74,.8,2000);assert(hr.valid());
  hr.update(false,0,0,3000);assert(hr.valid()&&hr.held());
  hr.update(false,0,0,32000);assert(!hr.valid());hr.reset();assert(!hr.valid());
  SafetyController safety;safety.network(true,1);safety.cameraPacket(1);safety.setMode(1,Mode::Gesture,1);safety.updateGestureTurn(1,10);
  assert(safety.snapshot(10).target.wz==0); // Selecting mode cannot initiate a turn.
  safety.autonomousStop(11);safety.cameraPacket(11);assert(!safety.autonomousTurn(true,170,11));
  safety.updateGestureTurn(-170,20);assert(safety.gestureTurnDegrees()==20);
  safety.updateGestureTurn(170,30);assert(safety.gestureTurnDegrees()==0); // Rocking is not a full rotation.
  safety.emergency(31);safety.updateGestureTurn(-170,40);assert(safety.snapshot(40).target.wz==0);
  BoxTrack box;VisionPacket face;face.found=true;face.score=800;face.seq=1;face.receivedMs=100;face.x0=100;face.x1=160;face.y0=60;face.y1=140;
  assert(box.update(face));assert(!box.update(face));face.seq=2;face.receivedMs=420;face.x0+=8;face.x1+=8;assert(box.update(face));
  assert(box.view(900).found);assert(!box.view(1121).found);
  auto distant=face;distant.x0=290;distant.x1=310;assert(box.cost(distant,420)>=1000);
  if(tuning::balanced){ImuFilter imu;for(unsigned t=10;t<=5100;t+=10)imu.update(0,0,1,0,0,0,t);
    assert(imu.state().calibrated);imu.update(0,0,8,0,0,0,5110);assert(imu.state().valid&&imu.state().held&&!imu.state().tiltFault);assert(imu.state().sampleMs==5100);
    for(unsigned t=5120;t<=5310;t+=10){imu.update(0,0,8,0,0,0,t);}assert(!imu.state().valid);
  }
  DemoPpg ppg;unsigned firstHr=0,firstSpo2=0;
  for(unsigned n=0;n<500;++n){float wave=std::sin(n*.04f*6.2831853f*1.25f);ppg.sample(uint32_t(100000+1000*wave),uint32_t(120000+2000*wave),40*(n+1));if(!firstHr&&ppg.hr.valid())firstHr=40*(n+1);if(!firstSpo2&&ppg.spo2.valid())firstSpo2=40*(n+1);}
  assert(firstHr>0&&firstHr<10000);assert(firstSpo2>0&&firstSpo2<12000);assert(std::abs(ppg.hr.output()-75)<4);
  ppg.reset();assert(!ppg.hr.valid()&&!ppg.spo2.valid());
  for(unsigned n=0;n<250;++n){ppg.sample(100000+n*10,120000+n*20,40*(n+1));}assert(!ppg.hr.valid());
  for(auto wanted:{BypassPhase::Halt,BypassPhase::Right,BypassPhase::Margin,BypassPhase::Pass,BypassPhase::Reacquire})for(int fault=0;fault<7;++fault){
    FrontConfig cfg;cfg.enabled=cfg.verified=cfg.bypassVerified=true;cfg.stopCm=20;cfg.slowCm=50;cfg.warnCm=60;cfg.releaseCm=70;cfg.lateralSpeed=.15;cfg.forwardSpeed=.15;cfg.settleMs=140;cfg.marginMs=210;cfg.passMs=280;cfg.lateralTimeoutMs=1400;
    SafetyController controller;controller.configureFront(cfg);controller.configureHardware(true,true);controller.network(true,1);
    auto feed=[&](uint64_t now,bool small,double cm){VisionPacket p;p.found=true;p.score=900;p.seq=now;p.receivedMs=now;p.x0=small?135:120;p.x1=small?185:200;p.y0=small?80:60;p.y1=small?140:160;controller.imu(true,true,false,now);controller.cameraPacket(now);controller.heartbeat(1,now);controller.person(p);controller.frontSample(cm,true,now);controller.computeFollow(now);};
    feed(1,false,120);assert(!controller.setMode(1,Mode::Follow,1));feed(71,false,120);feed(141,false,120);feed(211,false,120);assert(!controller.demo(1,true,212));
    uint64_t now=281;bool approached=false,clearing=false;
    for(;now<3500;now+=70){const auto before=controller.snapshot(now-70);approached=approached||before.target.vx>0;clearing=clearing||before.front.phase==BypassPhase::Right;feed(now,true,approached&&!clearing?18:120);if(controller.snapshot(now).front.phase==wanted)break;}
    assert(now<3500);
    if(fault==0)controller.emergency(now+1);
    if(fault==1)controller.network(false,now+1);
    uint64_t checkNow=now+1;
    if(fault==2){VisionPacket miss;miss.seq=now+1;miss.receivedMs=now+1;controller.person(miss);controller.tick(now+950);checkNow=now+950;}
    if(fault==3){controller.imu(false,false,false,now+1);controller.tick(now+250);checkNow=now+250;}
    if(fault==4)controller.frontSample(0,false,now+1);
    if(fault==5)controller.disconnect(1,now+1);
    if(fault==6)controller.fault(true,now+1);
    const auto stopped=controller.snapshot(checkNow);assert(stopped.mode==Mode::Idle&&!stopped.target.vx&&!stopped.target.vy&&!stopped.target.wz&&!stopped.front.demoEnabled);
  }
  std::cout<<"Demo display votes, action freshness, timed metric hold and gesture arbitration passed\n";
}
