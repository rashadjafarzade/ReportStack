"""Load a JSON command catalog and validate against a known schema.

Equivalent of Osprey's locator JSONs: per-device-family overrides without
recompiling Python. The catalog file maps a logical command name (the key
your tests use, like "set_freq" or "read_rssi") to the raw shell or SCPI
string sent to the device.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

# Every device family must implement at least these commands. Tests rely on
# them via RadioDevice.power_on/off, tune, read_rssi, is_locked. New radios
# can layer device-specific commands on top.
REQUIRED_KEYS = frozenset(
    {"power_on", "power_off", "set_freq", "read_rssi", "read_lock_state"}
)


def load_catalog(path: str | Path) -> Mapping[str, str]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"command catalog not found: {p}")
    raw = json.loads(p.read_text())
    if not isinstance(raw, dict):
        raise ValueError(
            f"{p}: expected a JSON object mapping command name -> command string"
        )
    missing = REQUIRED_KEYS - raw.keys()
    if missing:
        raise ValueError(
            f"{p}: missing required commands: {sorted(missing)}"
        )
    # Cast values to str for safety; reject non-strings explicitly.
    out = {}
    for k, v in raw.items():
        if not isinstance(v, str):
            raise ValueError(f"{p}: command {k!r} must map to a string, got {type(v)}")
        out[k] = v
    return out
