#include "continuous_servo_drive.h"
#include <cassert>
#include <limits>
#include <iostream>
uint32_t fakeNow=10;int attachCount=0,failAttach=0;uint32_t duties[64]={};
using namespace carerover;
int main(){
  const uint8_t pins[4]={10,11,12,13};ServoCalibration c={{1490,1500,1510,1520},{1,-1,1,-1},300,{100,200,300,400}};
  ContinuousServoDrive d;assert(d.begin(pins,c));uint32_t neutral[4];for(int i=0;i<4;++i)neutral[i]=duties[pins[i]];
  assert(d.commandChassis(.2f,0,0,240));fakeNow+=100;d.tick();assert(duties[10]>neutral[0]&&duties[11]<neutral[1]);
  WheelSpeeds invalid={{-.8f,0,std::numeric_limits<float>::quiet_NaN(),0}};
  auto before=d.target();assert(!d.commandWheels(invalid,100));for(int i=0;i<4;++i)assert(before.value[i]==d.target().value[i]);
  d.stopNow();for(int i=0;i<4;++i)assert(duties[pins[i]]==neutral[i]);
  d.commandChassis(1,0,0,100);fakeNow+=100;d.tick();assert(!d.moving());
  attachCount=0;failAttach=3;ContinuousServoDrive broken;assert(!broken.begin(pins,c));assert(!broken.ready());
  auto w=mixXDrive(1,1,1);assert(w.value[0]==1);assert(w.value[1]<0&&w.value[2]>0&&w.value[3]>0);
  std::cout<<"PWM calibration, atomic rejection, deadline and initialization failure passed\n";
}
