# CAM tracking firmware

Build and hardware handoff: [tracking development](../../docs/tracking-development.md).

ESP-IDF 5.3.4 / ESP-DL 3.3.11, 8 MB flash / OPI PSRAM. Camera RGB565BE QVGA pin map and gesture pipeline originate from the supplied CareRover CAM reference. Local model dependencies are materialized by `python tools/tracking.py prepare`; never copy a developer's managed_components/build directory.

The single capture loop alternates gesture and face inference. Each result emits a fresh CRC-protected G/P UART frame. No identity database or tracking through occlusion is implemented. Three bounded JPEG slots keep a slow viewer from overwriting the reader's buffer or blocking inference. `videoPublish` finishes JPEG validation before publishing; one asynchronous HTTP stream worker serves a single viewer and releases every reader lease on exit.

The shared wire contract is maintained in `../main_wireless/vision_protocol.h`. The local references are deliberate: the main UART decoder and CAM encoder use the same implementation and host test vectors.

Variants: gesture (G only), vision (G/P), stream (G/P+MJPEG), pico (alternative face model+MJPEG). Build profiles default to compile-only and use placeholder Wi-Fi credentials. Never treat such artifacts as a verified board image.

Espressif model/component licensing remains in their pinned upstream directories (`build/dependencies/esp-dl` and managed_components). Original handoff assets remain unchanged. This project's source ZIP fetches those fixed dependencies through the supplied preparation tool.
