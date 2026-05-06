"""Serial / UART controlled radio.

Useful for devices that expose a console over /dev/ttyUSB0 or similar — common
for lab benches and bring-up scenarios where the network stack isn't up yet.
"""
from __future__ import annotations

import time
from typing import Mapping

from radios.base import CommandResult, RadioDevice, RadioError

try:
    import serial  # type: ignore
except ImportError:  # pragma: no cover
    serial = None


class SerialRadio(RadioDevice):
    def __init__(
        self,
        *,
        name: str,
        port: str,
        baudrate: int = 115200,
        prompt: str = "# ",
        command_catalog: Mapping[str, str],
    ) -> None:
        super().__init__(name=name, command_catalog=command_catalog)
        if serial is None:
            raise RadioError("pyserial is not installed — pip install pyserial")
        self._prompt = prompt.encode()
        self._port = serial.Serial(port=port, baudrate=baudrate, timeout=1.0)
        # Drain any banner output before the first command.
        self._port.write(b"\n")
        self._read_until_prompt(timeout=2.0)

    def run(self, command: str, *, timeout: float = 10.0) -> CommandResult:
        start = time.monotonic()
        try:
            self._port.reset_input_buffer()
            self._port.write(command.encode() + b"\n")
            out = self._read_until_prompt(timeout=timeout)
        except Exception as e:
            raise RadioError(f"serial command failed: {command!r}: {e}") from e
        # Strip the echoed command and trailing prompt for cleanliness.
        decoded = out.decode("utf-8", errors="replace")
        decoded = decoded.replace(command, "", 1).strip()
        if decoded.endswith(self._prompt.decode()):
            decoded = decoded[: -len(self._prompt)].rstrip()
        return CommandResult(
            command=command,
            stdout=decoded,
            stderr="",
            exit_code=0,
            duration_ms=int((time.monotonic() - start) * 1000),
        )

    def close(self) -> None:
        try:
            self._port.close()
        except Exception:
            pass

    def _read_until_prompt(self, *, timeout: float) -> bytes:
        deadline = time.monotonic() + timeout
        buffer = bytearray()
        while time.monotonic() < deadline:
            chunk = self._port.read(256)
            if chunk:
                buffer.extend(chunk)
                if buffer.endswith(self._prompt):
                    return bytes(buffer)
            else:
                time.sleep(0.05)
        raise RadioError(
            f"timeout waiting for prompt {self._prompt!r}; got {bytes(buffer)!r}"
        )
