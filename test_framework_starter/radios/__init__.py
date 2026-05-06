"""Radio device abstractions.

The page-object analog for hardware: each RadioDevice subclass exposes a
small, business-flavoured API (power_on, tune, read_signal_quality) that
hides the transport details (SSH, serial, future TCP/IP control planes).
"""
from radios.base import RadioDevice, RadioError
from radios.ssh_radio import SSHRadio
from radios.serial_radio import SerialRadio

__all__ = ["RadioDevice", "RadioError", "SSHRadio", "SerialRadio"]
