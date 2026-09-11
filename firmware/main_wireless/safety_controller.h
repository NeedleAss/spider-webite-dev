#pragma once
#include <cmath>
#include <cstdint>

namespace carerover {
enum class Mode { Idle, Manual, Health };
inline const char* modeName(Mode m) {
  return m == Mode::Manual ? "MANUAL" : m == Mode::Health ? "HEALTH_CHECK" : "IDLE";
}
struct Targets { double vx = 0, vy = 0, wz = 0; };
struct SafetySnapshot {
  Mode mode = Mode::Idle;
  Targets target;
  bool estop = false, fault = false, camera = false, network = false;
  uint32_t owner = 0, stopSequence = 0;
  uint64_t lastCommandMs = 0, stoppedAtMs = 0;
  const char* stopReason = "boot";
};
// Pure shared logic: no Arduino, I/O, allocation, locks, or wall-clock access.
// Runtime calls it under a short critical section; host tests inject time.
class SafetyController {
 public:
  // Reserve 10 ms of the 250 ms contract for runtime scheduling jitter.
  static constexpr uint64_t CommandExpiryMs = 240;
  static constexpr uint64_t CameraExpiryMs = 1000;
  SafetySnapshot snapshot(uint64_t now) const {
    SafetySnapshot result = state_;
    result.camera = cameraSeen_ && now >= lastCameraMs_ && now - lastCameraMs_ < CameraExpiryMs;
    return result;
  }
  void cameraPacket(uint64_t now) { cameraSeen_ = true; lastCameraMs_ = now; }
  void network(bool online, uint64_t now) {
    state_.network = online;
    if (!online) stop(now, "network_down");
  }
  void fault(bool active, uint64_t now) {
    state_.fault = active;
    if (active) stop(now, "fault");
  }
  void disconnect(uint32_t client, uint64_t now) {
    if (state_.owner == client && client != 0) {
      stop(now, "owner_disconnected"); state_.owner = 0;
    }
  }
  void emergency(uint64_t now) { state_.estop = true; stop(now, "estop"); }
  const char* clear(uint32_t client, uint64_t now) {
    if (!client) return "INVALID_COMMAND";
    if (state_.fault || !state_.network) return "FAULT_ACTIVE";
    if (busy(client)) return "CONTROL_BUSY";
    state_.owner = client; state_.estop = false; stop(now, "estop_cleared");
    return nullptr;
  }
  const char* setMode(uint32_t client, Mode mode, uint64_t now) {
    tick(now);
    if (!client) return "INVALID_COMMAND";
    if (state_.estop) return "ESTOP_ACTIVE";
    if (state_.fault || !state_.network) return "FAULT_ACTIVE";
    if (busy(client)) return "CONTROL_BUSY";
    if (mode == Mode::Manual && !snapshot(now).camera) return "CAMERA_OFFLINE";
    state_.owner = client; stop(now, "mode_changed"); state_.mode = mode;
    return nullptr;
  }
  const char* velocity(uint32_t client, double vx, double vy, double wz, uint64_t now) {
    tick(now);
    if (!valid(vx) || !valid(vy) || !valid(wz) || !client) return "INVALID_COMMAND";
    if (busy(client)) return "CONTROL_BUSY";
    // A zero release never acquires control or renews a stopped/manual lease.
    if (vx == 0 && vy == 0 && wz == 0) { state_.target = {}; armed_ = false; return nullptr; }
    if (state_.estop) return "ESTOP_ACTIVE";
    if (state_.fault || !state_.network) return "FAULT_ACTIVE";
    if (state_.mode != Mode::Manual || state_.owner != client) return "NOT_IN_MANUAL";
    if (!snapshot(now).camera) return "CAMERA_OFFLINE";
    state_.target = {vx, vy, wz}; state_.lastCommandMs = now; armed_ = true;
    return nullptr;
  }
  void tick(uint64_t now) {
    if (state_.mode == Mode::Manual && !snapshot(now).camera) stop(now, "camera_timeout");
    if (armed_ && now - state_.lastCommandMs >= CommandExpiryMs) stop(now, "watchdog");
  }
  void stop(uint64_t now, const char* reason) {
    state_.target = {}; state_.mode = Mode::Idle; armed_ = false;
    state_.stoppedAtMs = now; state_.stopReason = reason; ++state_.stopSequence;
  }
 private:
  static bool valid(double v) { return std::isfinite(v) && v >= -1 && v <= 1; }
  bool busy(uint32_t client) const { return state_.owner != 0 && state_.owner != client; }
  SafetySnapshot state_;
  uint64_t lastCameraMs_ = 0;
  bool cameraSeen_ = false, armed_ = false;
};
}  // namespace carerover
