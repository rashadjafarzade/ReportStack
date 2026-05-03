"""SSH-controlled Linux radio.

Uses paramiko to open a single persistent SSH session and execute commands
against the device's shell. Suitable for any radio that exposes its control
plane over SSH — the common case for Linux-based SDRs and embedded radios.
"""
from __future__ import annotations

import time
from typing import Mapping

from radios.base import CommandResult, RadioDevice, RadioError

try:
    import paramiko  # type: ignore
except ImportError:  # pragma: no cover
    paramiko = None  # let import succeed; raise on construction


class SSHRadio(RadioDevice):
    def __init__(
        self,
        *,
        name: str,
        host: str,
        username: str = "root",
        password: str | None = None,
        key_filename: str | None = None,
        port: int = 22,
        command_catalog: Mapping[str, str],
    ) -> None:
        super().__init__(name=name, command_catalog=command_catalog)
        if paramiko is None:
            raise RadioError(
                "paramiko is not installed — pip install paramiko"
            )
        self._client = paramiko.SSHClient()
        self._client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self._client.connect(
            hostname=host,
            port=port,
            username=username,
            password=password,
            key_filename=key_filename,
            timeout=10.0,
        )

    def run(self, command: str, *, timeout: float = 10.0) -> CommandResult:
        start = time.monotonic()
        try:
            stdin, stdout, stderr = self._client.exec_command(
                command, timeout=timeout
            )
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            code = stdout.channel.recv_exit_status()
        except Exception as e:
            raise RadioError(f"ssh exec failed: {command!r}: {e}") from e
        return CommandResult(
            command=command,
            stdout=out,
            stderr=err,
            exit_code=code,
            duration_ms=int((time.monotonic() - start) * 1000),
        )

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:
            pass
