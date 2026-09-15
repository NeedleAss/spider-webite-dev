import sys
import time

import serial


port = sys.argv[1] if len(sys.argv) > 1 else "COM6"
axis = sys.argv[2] if len(sys.argv) > 2 else "longitudinal"
sequences = {
    "longitudinal": (("f 20 600", 1.1), ("b 20 600", 1.1)),
    "lateral": (("r 20 600", 1.1), ("l 20 600", 1.1)),
    "rotation": (("cw 20 300", 1.0), ("ccw 20 300", 1.0)),
}
if axis not in sequences:
    raise SystemExit("axis must be longitudinal, lateral, or rotation")

ser = serial.Serial(port, 115200, timeout=0.1)
chunks: list[str] = []


def send(command: str, wait_seconds: float) -> None:
    ser.write((command + "\n").encode("ascii"))
    ser.flush()
    time.sleep(wait_seconds)
    chunks.append(ser.read_all().decode("utf-8", "replace"))


try:
    time.sleep(0.4)
    ser.reset_input_buffer()
    send("arm", 0.3)
    send("status", 0.3)
    for command, wait_seconds in sequences[axis]:
        send(command, wait_seconds)
        send("status", 0.4)
    send("stop", 0.2)
    send("disarm", 0.3)
    send("status", 0.5)
finally:
    ser.write(b"stop\ndisarm\n")
    ser.flush()
    time.sleep(0.2)
    chunks.append(ser.read_all().decode("utf-8", "replace"))
    ser.close()

print("".join(chunks), end="")
