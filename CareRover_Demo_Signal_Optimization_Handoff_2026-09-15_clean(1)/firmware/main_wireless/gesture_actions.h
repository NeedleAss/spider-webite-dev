#pragma once

#include <cctype>
#include <cstdint>
#include <cstring>

namespace carerover {

enum class GestureAction { None, StartFollow, Stop, TurnClockwise, TurnCounterClockwise };

inline bool gestureActionBoxValid(const char* label, int x0, int y0, int x1, int y1) {
  constexpr int kMinActionBoxWidth = 80;
  constexpr int kMinActionBoxHeight = 120;
  // Starting follow is additionally guarded by a fresh person target, an
  // online supervising station, a healthy IMU and the four-frame latch.  The
  // field trace shows a real shoulder-level LIKE at 114-119 px high, so only
  // LIKE gets a slightly lower height gate.  Unattended turn actions retain
  // the stricter dimensions established by the static-background evidence.
  const bool isLike = label &&
                      (!std::strcmp(label, "like") || !std::strcmp(label, "LIKE"));
  const int minHeight = isLike ? 110 : kMinActionBoxHeight;
  return x1 > x0 && y1 > y0 && x1 - x0 >= kMinActionBoxWidth &&
         y1 - y0 >= minHeight;
}

class GestureActionLatch {
 public:
  GestureActionLatch(uint8_t confirmationFrames = 4, uint8_t releaseFrames = 3)
      : confirmationFrames_(confirmationFrames), releaseFrames_(releaseFrames) {}

  GestureAction update(bool accepted, const char* label) {
    if (!accepted || !label || !label[0]) {
      candidate_[0] = '\0';
      candidateFrames_ = 0;
      if (active_[0] && releasedFrames_ < UINT8_MAX) ++releasedFrames_;
      if (releasedFrames_ >= releaseFrames_) active_[0] = '\0';
      return GestureAction::None;
    }
    char normalized[16] = {};
    size_t i = 0;
    for (; label[i] && i + 1 < sizeof(normalized); ++i) {
      normalized[i] = static_cast<char>(std::toupper(static_cast<unsigned char>(label[i])));
    }
    releasedFrames_ = 0;
    if (!std::strcmp(active_, normalized)) {
      candidate_[0] = '\0';
      candidateFrames_ = 0;
      return GestureAction::None;
    }
    if (!std::strcmp(candidate_, normalized)) {
      if (candidateFrames_ < UINT8_MAX) ++candidateFrames_;
    } else {
      std::strcpy(candidate_, normalized);
      candidateFrames_ = 1;
    }
    // Stopping should remain responsive.  Any gesture that can start motion
    // deliberately needs the longer confirmation window.
    const uint8_t requiredFrames = !std::strcmp(normalized, "DISLIKE")
                                       ? static_cast<uint8_t>(2)
                                       : confirmationFrames_;
    if (candidateFrames_ < requiredFrames) return GestureAction::None;
    std::strcpy(active_, normalized);
    candidate_[0] = '\0';
    candidateFrames_ = 0;
    if (!std::strcmp(normalized, "LIKE")) return GestureAction::StartFollow;
    if (!std::strcmp(normalized, "DISLIKE")) return GestureAction::Stop;
    if (!std::strcmp(normalized, "TWO")) return GestureAction::TurnClockwise;
    if (!std::strcmp(normalized, "OK")) return GestureAction::TurnCounterClockwise;
    return GestureAction::None;
  }

 private:
  char active_[16] = {};
  char candidate_[16] = {};
  uint8_t candidateFrames_ = 0;
  uint8_t releasedFrames_ = 0;
  uint8_t confirmationFrames_;
  uint8_t releaseFrames_;
};

}  // namespace carerover
