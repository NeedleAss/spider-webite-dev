#pragma once

#include <math.h>
#include <stdint.h>

namespace carerover {

enum WheelIndex : uint8_t {
  FRONT_LEFT = 0,
  FRONT_RIGHT = 1,
  REAR_LEFT = 2,
  REAR_RIGHT = 3,
  WHEEL_COUNT = 4
};

struct WheelSpeeds {
  float value[WHEEL_COUNT];
};

inline float clampUnit(float value) {
  if (value > 1.0f) return 1.0f;
  if (value < -1.0f) return -1.0f;
  return value;
}

// Coordinate contract shared with the CareRover webpage:
//   vx > 0: forward, vy > 0: move right, wz > 0: rotate clockwise.
//
// Layout contract (top of supplied CAD image is FRONT):
//   FL -------- FR
//      diagonal wheel axes
//        chassis center
//      diagonal wheel axes
//   RL -------- RR
//
// A positive wheel value means its mechanically calibrated "forward" direction.
// Per-servo electrical inversion is deliberately handled below this layer.
inline WheelSpeeds mixXDrive(float vx, float vy, float wz) {
  vx = clampUnit(vx);
  vy = clampUnit(vy);
  wz = clampUnit(wz);

  WheelSpeeds output = {{
    vx + vy + wz,  // front-left
    vx - vy - wz,  // front-right
    vx - vy + wz,  // rear-left
    vx + vy - wz   // rear-right
  }};

  float peak = 1.0f;
  for (uint8_t i = 0; i < WHEEL_COUNT; ++i) {
    const float magnitude = fabsf(output.value[i]);
    if (magnitude > peak) peak = magnitude;
  }
  for (uint8_t i = 0; i < WHEEL_COUNT; ++i) {
    output.value[i] /= peak;
  }
  return output;
}

}  // namespace carerover
