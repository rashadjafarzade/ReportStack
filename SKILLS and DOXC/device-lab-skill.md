---
name: device-lab-tnc
description: Manage the TNC radio device lab — device connectivity, health checks, pre-test readiness, firmware inventory, and lab infrastructure on twd00030. Use this skill when the user asks about radio devices, lab setup, device health, RPi configuration, network switches, power supply, pre-flight checks, or any physical test environment topic. Trigger on phrases like "lab", "radio", "device", "RPi", "raspberry pi", "power supply", "pre-flight", "device health", "firmware version", or any mention of physical test infrastructure.
---

# TNC Device Lab Skill

## Purpose

Manage the physical test lab for TNC automation: 2 radio devices connected via LAN through a Raspberry Pi to the twd00030 Linux host. This skill covers device inventory, connectivity, health monitoring, pre-test readiness gates, and lab expansion.

---

## Current Lab Topology

```
                    ┌─────────────────────────────┐
                    │  twd00030 (Linux)            │
                    │  172.16.64.129               │
                    │                              │
                    │  Jenkins + ReportStack +     │
                    │  test runner (Docker)         │
                    └──────────┬──────────────────┘
                               │ LAN (eno1)
                               │
                    ┌──────────┴──────────────────┐
                    │      Network Switch          │
                    └──┬──────────────────────┬───┘
                       │                      │
                 ┌─────┴─────┐          ┌─────┴─────┐
                 │  RPi #1   │          │  RPi #2   │
                 │           │          │           │
                 └─────┬─────┘          └─────┬─────┘
                       │ LAN                  │ LAN
                 ┌─────┴─────┐          ┌─────┴─────┐
                 │  Radio #1 │          │  Radio #2 │
                 └───────────┘          └───────────┘

    Architecture: 1 RPi per radio (dedicated gateway)
    Power: Manual power supply per device (no smart PDU)
    Control: REST API over LAN (via each RPi)
    No USB, no serial, no IR blaster
```

Each radio has its own dedicated RPi acting as a network gateway. This gives:
- **Isolation**: one RPi going down doesn't affect the other radio
- **Independent power cycles**: can reboot one RPi+radio pair without disrupting the other
- **Future parallel execution**: each RPi+radio pair is an independent test target

## Device Inventory

```
# Configuration/lab_inventory.json
{
  "lab_id": "tnc-lab-01",
  "location": "twd00030 via switch",
  "devices": [
    {
      "id": "radio-01",
      "alias": "TNC Radio 1",
      "hostname": "",
      "ip": "",
      "model": "",
      "connection": "LAN via RPi #1",
      "power": "manual",
      "rpi": {
        "id": "rpi-01",
        "hostname": "",
        "ip": "",
        "user": "",
        "notes": "Dedicated gateway for Radio 1"
      },
      "notes": "Primary test device"
    },
    {
      "id": "radio-02",
      "alias": "TNC Radio 2",
      "hostname": "",
      "ip": "",
      "model": "",
      "connection": "LAN via RPi #2",
      "power": "manual",
      "rpi": {
        "id": "rpi-02",
        "hostname": "",
        "ip": "",
        "user": "",
        "notes": "Dedicated gateway for Radio 2"
      },
      "notes": "Secondary test device"
    }
  ]
}
```

> Fill in IP addresses, hostnames, and model numbers once confirmed. This file is the single source of truth for lab topology.

---

## RPi Role

Each Raspberry Pi acts as a **dedicated network gateway** for its paired radio device. RPis are not running test code — they provide LAN connectivity between the switch and their radio.

### Why 1:1 RPi-to-Radio
- **Fault isolation**: RPi crash only affects one radio
- **Independent management**: reboot, update, or troubleshoot one pair without touching the other
- **Parallel test targets**: future support for running different suites against different radios simultaneously
- **Simpler networking**: each RPi bridges exactly one radio, no routing complexity

### RPi Setup Checklist (repeat per RPi)

```bash
# SSH into RPi #1
ssh <user>@<rpi-01-ip>

# Verify its radio is reachable from RPi
ping -c 3 <radio-01-ip>
curl -kf https://<radio-01-ip>/api/v1/status && echo "Radio 1 OK from RPi 1"

# Repeat for RPi #2
ssh <user>@<rpi-02-ip>
ping -c 3 <radio-02-ip>
curl -kf https://<radio-02-ip>/api/v1/status && echo "Radio 2 OK from RPi 2"

# From twd00030: verify both RPis reachable
ping -c 3 <rpi-01-ip>
ping -c 3 <rpi-02-ip>

# From twd00030: verify both radios reachable end-to-end
curl -kf --max-time 5 https://<radio-01-ip>/api/v1/status && echo "Radio 1 OK"
curl -kf --max-time 5 https://<radio-02-ip>/api/v1/status && echo "Radio 2 OK"
```

### Network Path

```
twd00030 → Switch → RPi #1 → Radio #1
                  → RPi #2 → Radio #2
```

Test container with `--network host` can reach all IPs on the switch subnet. Verify from inside Docker:

```bash
docker run --rm --network host curlimages/curl \
  curl -kf https://<radio-01-ip>/api/v1/status
```

---

## Lab Scripts

All lab management scripts live in a dedicated directory in the automation repo.

### Directory Structure

```
lab/
├── inventory.json          # Device inventory (copy of lab_inventory.json)
├── health_check.py         # Check all devices reachable + responding
├── firmware_report.py      # Print firmware/build versions for all devices
├── pre_flight.py           # Pre-test readiness gate
├── power_cycle.md          # Manual power cycle instructions (no smart PDU)
└── requirements.txt        # requests, tabulate (minimal deps)
```

### health_check.py

Checks every device in inventory is reachable and its REST API responds.

```python
#!/usr/bin/env python3
"""Lab health check — verify all radio devices are reachable."""

import json
import sys
from pathlib import Path

import requests

INVENTORY = Path(__file__).parent / "inventory.json"
TIMEOUT = 10  # seconds


def load_inventory():
    with open(INVENTORY) as f:
        return json.load(f)


def check_device(device: dict) -> dict:
    ip = device.get("ip")
    if not ip:
        return {**device, "status": "NO_IP", "detail": "IP not configured"}
    try:
        r = requests.get(
            f"https://{ip}/api/v1/status",
            timeout=TIMEOUT,
            verify=False,
        )
        if r.ok:
            return {**device, "status": "OK", "detail": r.json()}
        return {**device, "status": "HTTP_ERROR", "detail": f"HTTP {r.status_code}"}
    except requests.ConnectionError:
        return {**device, "status": "UNREACHABLE", "detail": "Connection refused/timeout"}
    except Exception as e:
        return {**device, "status": "ERROR", "detail": str(e)}


def check_rpi(rpi: dict) -> str:
    ip = rpi.get("ip")
    if not ip:
        return "NO_IP"
    import socket
    try:
        s = socket.create_connection((ip, 22), timeout=5)
        s.close()
        return "OK"
    except Exception:
        return "UNREACHABLE"


def main():
    inv = load_inventory()
    results = []

    # Check each device + its dedicated RPi
    for device in inv.get("devices", []):
        rpi = device.get("rpi", {})
        rpi_ip = rpi.get("ip", "")
        rpi_status = check_rpi(rpi) if rpi_ip else "NO_IP"
        rpi_icon = "OK" if rpi_status == "OK" else "FAIL"
        print(f"  [{rpi_icon}] {rpi.get('id', '?')} ({rpi_ip or '?'}): {rpi_status}")

        result = check_device(device)
        results.append(result)
        status_icon = "OK" if result["status"] == "OK" else "FAIL"
        print(f"  [{status_icon}] {device['alias']} ({device.get('ip', '?')}): {result['status']}")

    # Exit code for CI
    failed = [r for r in results if r["status"] != "OK"]
    if failed:
        print(f"\n{len(failed)} device(s) not ready.")
        sys.exit(1)
    print("\nAll devices healthy.")


if __name__ == "__main__":
    main()
```

### firmware_report.py

Queries each radio's REST API for version info and prints a table.

```python
#!/usr/bin/env python3
"""Print firmware/build version for all lab radios."""

import json
from pathlib import Path

import requests

INVENTORY = Path(__file__).parent / "inventory.json"


def get_version(ip: str) -> dict:
    try:
        r = requests.get(f"https://{ip}/api/v1/status", timeout=10, verify=False)
        if r.ok:
            data = r.json()
            return {
                "firmware": data.get("firmware_version", "?"),
                "build": data.get("build_version", "?"),
                "model": data.get("model_number", "?"),
                "serial": data.get("serial_number", "?"),
            }
    except Exception:
        pass
    return {"firmware": "UNREACHABLE", "build": "-", "model": "-", "serial": "-"}


def main():
    with open(INVENTORY) as f:
        inv = json.load(f)

    print(f"{'Device':<20} {'IP':<18} {'Model':<12} {'Serial':<14} {'Firmware':<16} {'Build'}")
    print("-" * 100)
    for d in inv.get("devices", []):
        ip = d.get("ip", "")
        info = get_version(ip) if ip else {"firmware": "NO_IP", "build": "-", "model": "-", "serial": "-"}
        print(f"{d['alias']:<20} {ip:<18} {info['model']:<12} {info['serial']:<14} {info['firmware']:<16} {info['build']}")


if __name__ == "__main__":
    main()
```

### pre_flight.py

The **gate that runs before every test suite** in Jenkins. Fails the build early if any device is not ready.

```python
#!/usr/bin/env python3
"""
Pre-flight check for TNC automation.
Run before test suite to verify lab readiness.
Exit code 0 = all clear, 1 = not ready.

Usage:
  python lab/pre_flight.py
  python lab/pre_flight.py --device radio-01    # check single device
"""

import argparse
import json
import sys
from pathlib import Path

import requests

INVENTORY = Path(__file__).parent / "inventory.json"
TIMEOUT = 15


def check_radio_api(ip: str) -> tuple:
    """Returns (ok: bool, detail: str)."""
    try:
        r = requests.get(f"https://{ip}/api/v1/status", timeout=TIMEOUT, verify=False)
        if r.ok:
            return True, "API responding"
        return False, f"HTTP {r.status_code}"
    except requests.ConnectionError:
        return False, "Connection refused — device may be off or rebooting"
    except requests.Timeout:
        return False, f"Timeout after {TIMEOUT}s"
    except Exception as e:
        return False, str(e)


def check_radio_web_ui(ip: str) -> tuple:
    """Verify TNC web UI is serving."""
    try:
        r = requests.get(f"https://{ip}/", timeout=TIMEOUT, verify=False)
        if r.ok:
            return True, "Web UI accessible"
        return False, f"HTTP {r.status_code}"
    except Exception as e:
        return False, str(e)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", help="Check single device by ID")
    args = parser.parse_args()

    with open(INVENTORY) as f:
        inv = json.load(f)

    devices = inv.get("devices", [])
    if args.device:
        devices = [d for d in devices if d["id"] == args.device]
        if not devices:
            print(f"Device '{args.device}' not found in inventory.")
            sys.exit(1)

    print("=" * 60)
    print("TNC Lab Pre-Flight Check")
    print("=" * 60)

    all_ok = True
    for d in devices:
        ip = d.get("ip")
        print(f"\n{d['alias']} ({d['id']}) — {ip or 'NO IP'}")

        if not ip:
            print("  [SKIP] No IP configured")
            all_ok = False
            continue

        # Check 1: REST API
        ok, detail = check_radio_api(ip)
        print(f"  [{'PASS' if ok else 'FAIL'}] REST API: {detail}")
        if not ok:
            all_ok = False

        # Check 2: Web UI
        ok, detail = check_radio_web_ui(ip)
        print(f"  [{'PASS' if ok else 'FAIL'}] Web UI:   {detail}")
        if not ok:
            all_ok = False

    print("\n" + "=" * 60)
    if all_ok:
        print("PRE-FLIGHT: ALL CHECKS PASSED")
        sys.exit(0)
    else:
        print("PRE-FLIGHT: FAILED — fix issues before running tests")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

---

## Power Management

### Current State: Manual

No smart PDU — radios are powered by a manual power supply. To power cycle:

1. Turn off power supply
2. Wait 10 seconds
3. Turn on power supply
4. Wait 60-90 seconds for radios to boot
5. Verify with `python lab/health_check.py`

### Future: Smart PDU (recommended upgrade)

When budget allows, add a network-controllable PDU (e.g., TP-Link Kasa smart plug, Ubiquiti smart power strip, or an IP-controlled PDU like Osprey's IPPower). This enables:

```python
# lab/power_control.py (future — when smart PDU is available)

class PowerController:
    def __init__(self, pdu_ip: str, pdu_type: str = "kasa"):
        self.pdu_ip = pdu_ip
        self.pdu_type = pdu_type

    def power_off(self, outlet: int):
        """Cut power to device on given outlet."""
        ...

    def power_on(self, outlet: int):
        """Restore power to device on given outlet."""
        ...

    def power_cycle(self, outlet: int, delay: int = 10):
        """Power off, wait, power on."""
        self.power_off(outlet)
        time.sleep(delay)
        self.power_on(outlet)
```

Add outlet mapping to `inventory.json`:

```json
{
  "id": "radio-01",
  "power": {
    "pdu_ip": "192.168.1.200",
    "outlet": 1,
    "type": "kasa"
  }
}
```

---

## Jenkins Integration

### Pre-Flight Stage

Add to the Jenkinsfile (from automation-architect-skill):

```groovy
stage('Pre-flight') {
    steps {
        sh """
            docker run --rm --network host \
              -v $WORKSPACE/lab:/app/lab \
              $IMAGE_TAG \
              python /app/lab/pre_flight.py
        """
    }
}
```

If pre-flight fails, the build stops before wasting time on tests against unreachable devices.

### Firmware Report (post-build info)

```groovy
post {
    always {
        sh """
            docker run --rm --network host \
              -v $WORKSPACE/lab:/app/lab \
              $IMAGE_TAG \
              python /app/lab/firmware_report.py || true
        """
        junit 'reports/junit.xml'
    }
}
```

---

## Monitoring (Lightweight)

### Option A: Cron on twd00030

Simple cron job that runs health check every 15 minutes and logs results:

```bash
# crontab -e (on twd00030)
*/15 * * * * cd ~/projects/tnc-automation && python3 lab/health_check.py >> /var/log/tnc-lab-health.log 2>&1
```

### Option B: RPi Health Agent (future)

Run a tiny Flask/FastAPI app on the RPi that:
- Pings radios every 60 seconds
- Exposes `/health` endpoint
- twd00030 monitoring can poll RPi's `/health`

```python
# Runs on RPi — future improvement
# GET http://<rpi-ip>:8080/health
# Returns: {"radio-01": "ok", "radio-02": "unreachable", "timestamp": "..."}
```

---

## Troubleshooting

### Radio unreachable from twd00030

```bash
# 1. Identify which RPi serves this radio (check inventory.json)

# 2. Check if that RPi is reachable
ping -c 3 <rpi-ip>

# 3. SSH into the RPi, check if its radio responds
ssh <user>@<rpi-ip>
ping -c 3 <radio-ip>
curl -k https://<radio-ip>/api/v1/status

# 4. If radio responds from RPi but not from twd00030:
#    → routing issue. Check switch config, IP subnets, firewall.

# 5. If radio doesn't respond from RPi either:
#    → radio is off, rebooting, or crashed. Power cycle the radio manually.
#    → if RPi itself is unresponsive, power cycle the RPi too.
```

### Radio responds but tests fail

```bash
# Check if web UI is loading (Selenium needs this)
curl -k https://<radio-ip>/

# Check if radio is in correct mode
curl -k https://<radio-ip>/api/v1/status | python3 -m json.tool

# Check if radio needs reboot after config change
curl -k https://<radio-ip>/api/v1/status | grep -i reboot
```

### Docker test container can't reach radio

```bash
# Test from inside Docker with host networking
docker run --rm --network host curlimages/curl \
  curl -kf https://<radio-ip>/api/v1/status

# All test containers MUST use --network host.
# This is required so the container can reach both:
#   - Radio devices on the LAN (via RPi/switch)
#   - ReportStack backend at http://localhost:8000
# See automation-architect-skill.md Jenkinsfile for the canonical docker run command.
```

### RPi lost connectivity

```bash
# Identify which RPi (check inventory.json for the device's rpi.ip)
ssh <user>@<rpi-ip>

# If SSH fails:
# 1. Check switch port LEDs — RPi link light on?
# 2. Check power to RPi (each RPi has its own power)
# 3. Physical access: connect monitor, check RPi is booted
# 4. If RPi has static IP, verify it hasn't changed (check /etc/dhcpcd.conf)
# 5. Only the radio paired with this RPi is affected — the other pair is independent
```

---

## Lab Expansion Guide

### Adding a New Radio Device

Each new radio needs its own RPi (1:1 pairing):

1. Set up a new RPi: install Raspberry Pi OS, assign static IP, enable SSH
2. Connect RPi to switch via LAN
3. Connect new radio to RPi via LAN
4. Add entry to `lab/inventory.json`:
   ```json
   {
     "id": "radio-03",
     "alias": "TNC Radio 3",
     "ip": "x.x.x.x",
     "model": "",
     "connection": "LAN via RPi #3",
     "power": "manual",
     "rpi": {
       "id": "rpi-03",
       "hostname": "",
       "ip": "x.x.x.x",
       "user": "pi",
       "notes": "Dedicated gateway for Radio 3"
     },
     "notes": ""
   }
   ```
5. Run `python lab/health_check.py` to verify
6. Update `pytest.ini` or suite configs if device-specific runs are needed

### Adding Smart PDU

1. Connect PDU to switch, assign static IP
2. Map outlets to devices in `inventory.json` (`power.pdu_ip`, `power.outlet`)
3. Implement `lab/power_control.py` for the specific PDU model
4. Add power-cycle step to Jenkins pre-flight (for stuck devices)
5. Add `lab/auto_recovery.py` — power-cycle + wait + health-check loop

---

## When to Load This Skill

Load when:
- Setting up or expanding the TNC radio device lab
- Debugging device connectivity issues
- Configuring pre-flight checks for Jenkins
- Adding new radio devices to the inventory
- Discussing power management or lab hardware
- RPi setup, networking, or troubleshooting
- Planning lab monitoring or health dashboards

Do not load for:
- Framework architecture or test design (use automation-architect-skill.md)
- ReportStack application code (use CLAUDE.md)
- twd00030 host infrastructure unrelated to the lab (use cicd-skill.md)
