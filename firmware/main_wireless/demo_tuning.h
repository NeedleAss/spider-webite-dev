#pragma once
#include <cstdint>
#if defined(ARDUINO) && __has_include("build_version.h")
#include "build_version.h"
#endif
#if defined(CONFIG_CAREROVER_TUNING_PROFILE) && !defined(CAREROVER_TUNING_PROFILE)
#define CAREROVER_TUNING_PROFILE CONFIG_CAREROVER_TUNING_PROFILE
#endif
#ifndef CAREROVER_TUNING_PROFILE
#define CAREROVER_TUNING_PROFILE 0
#endif
static_assert(CAREROVER_TUNING_PROFILE>=0 && CAREROVER_TUNING_PROFILE<=2,"Invalid tuning profile");
namespace carerover::tuning {
inline constexpr bool balanced=CAREROVER_TUNING_PROFILE==1;
inline constexpr const char* name=balanced?"DEMO_BALANCED":CAREROVER_TUNING_PROFILE==2?"DIAGNOSTIC_RAW":"SAFE_BASELINE";
inline constexpr uint16_t GestureDisplayEnter=balanced?350:450, GestureDisplayHold=balanced?180:250;
inline constexpr uint16_t GestureActionScore=450;
inline constexpr uint64_t GestureDisplayHoldMs=1800, GestureDisplayNoHandMs=900;
inline constexpr uint64_t CameraSafetyMs=490, PersonSafetyMs=490, ImuSafetyMs=100, CommandSafetyMs=240;
inline constexpr uint64_t PersonDisplayMs=700, HrDisplayHoldMs=30000, Spo2DisplayHoldMs=balanced?12000:8000;
inline constexpr float ImuSafetyTiltDeg=40, ImuSafetyRecoverDeg=30;
inline constexpr uint64_t ImuSafetyTiltMs=200;
// Relaxing tilt or allowing prediction to drive requires physical A/B evidence.
}
