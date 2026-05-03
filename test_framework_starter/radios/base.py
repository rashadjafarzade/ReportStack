"""Abstract RadioDevice — the contract every transport implementation honours.

Why an interface? It lets tests be written once against the abstract API and
run against an SSH-controlled radio in CI, a serial-controlled radio in the
lab, or a stubbed in-memory radio in unit tests, with no test-code changes.
This is the same pattern as Osprey's interface+impl POM split.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator, Mapping


class RadioError(RuntimeError):
    """Raised when a device command fails or its output can't be parsed."""


@dataclass(frozen=True)
class CommandResult:
    """Result of running one device command."""
    command: str
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int


class RadioDevice(ABC):
    """Abstract radio control surface used by every step / test.

    Implementations only need to provide :meth:`run` and :meth:`close` —
    every higher-level helper (tune, power, measure) composes on top of them.
    """

    def __init__(self, *, name: str, command_catalog: Mapping[str, str]) -> None:
        self.name = name
        # The catalog maps logical command names ("set_freq", "read_rssi") to
        # the actual shell or SCPI string sent to the device. It's loaded from
        # JSON per device family — see commands/loader.py.
        self.commands = dict(command_catalog)

    # ---- transport contract ----------------------------------------------
    @abstractmethod
    def run(self, command: str, *, timeout: float = 10.0) -> CommandResult:
        """Send a raw command to the device and return its CommandResult."""

    @abstractmethod
    def close(self) -> None:
        """Release any underlying connection."""

    @contextmanager
    def session(self) -> Iterator["RadioDevice"]:
        """Use as ``with device.session() as d: ...`` to ensure cleanup."""
        try:
            yield self
        finally:
            self.close()

    # ---- catalog-driven helpers ------------------------------------------
    def cmd(self, key: str, **fmt: Any) -> CommandResult:
        """Look up a command by its logical name and run it with formatting.

        Example:
            >>> device.cmd("set_freq", mhz=433.92)

        The catalog entry can use Python str.format placeholders.
        """
        if key not in self.commands:
            raise RadioError(f"unknown command {key!r} on {self.name}")
        rendered = self.commands[key].format(**fmt)
        return self.run(rendered)

    # ---- business-flavoured surface --------------------------------------
    # These are the methods steps and tests actually use. They depend only on
    # the abstract interface, so any transport works.
    def power_on(self) -> None:
        self.cmd("power_on")

    def power_off(self) -> None:
        self.cmd("power_off")

    def tune(self, freq_mhz: float) -> None:
        self.cmd("set_freq", mhz=freq_mhz)

    def read_rssi(self) -> int:
        """Return RSSI in dBm (negative integer)."""
        result = self.cmd("read_rssi")
        try:
            return int(result.stdout.strip())
        except ValueError as e:
            raise RadioError(f"unparseable RSSI: {result.stdout!r}") from e

    def is_locked(self) -> bool:
        """True if the radio reports PLL/demodulator lock."""
        result = self.cmd("read_lock_state")
        return result.stdout.strip().lower() in {"locked", "1", "true"}
