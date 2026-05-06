# Automation Architect Skill — Review & Improvement Notes

> **How to use this file**: Each section mirrors the actual `automation-architect-skill.md`.
> Edit inline — add comments, corrections, or strike through items.
> Mark items with `[OK]`, `[FIX]`, `[ADD]`, or `[REMOVE]` so changes can be applied back.

---

## 1. Current State — TNC Framework

```
Language:    Python 3.10+
Runner:      pytest 7.1.3
Browser:     Selenium WebDriver 4.5.0 (Firefox/GeckoDriver)
Protocols:   REST API, MQTT, Protobuf, SSH
Waveforms:   TSM, Katana/Narrowband, Programming Mode
```

**Review questions:**
- [ ] Are the Python / pytest / Selenium versions still accurate?
- [ ] Any new protocols or waveforms added since the doc was written?
- [ ] Is Firefox/GeckoDriver still the only browser, or is Chrome/Edge also needed?

**Your notes:**
```
(write here)
```

---

## 2. Target Architecture — 4-Layer Model

```
Test_Cases/  →  Tests (thin: call steps, assert)
Steps/       →  Business-logic workflows (multi-page orchestration)  [NEW]
TNC/         →  Page Objects (UI interactions, explicit waits)
Locators/    →  JSON-externalized element definitions                [NEW]
Helper/      →  Radio API, MQTT, Protobuf, SSH, utilities (unchanged)
```

**Review questions:**
- [ ] Is the layer naming OK? (`Steps/` vs something like `Workflows/`)
- [ ] Should `Helper/` be renamed to something more specific (e.g., `Infra/`, `RadioLib/`)?
- [ ] Any concern about test writers needing to understand 4 layers vs current 3?

**Your notes:**
```
(write here)
```

---

## 3. BasePage + JSON Locators

The skill defines a `BasePage` class that:
- Loads locators from `Locators/*.json` files
- Supports `{placeholder}` substitution in locator values
- Wraps `click()`, `get_text()`, `send_keys()` with `WebDriverWait`
- Maps `"css"`, `"xpath"`, `"id"` strings to Selenium `By.*`

**Review questions:**
- [ ] Does the existing TNC framework already have a base page class? If yes, what methods does it have?
- [ ] Is 25s the right default `timeout` for explicit waits?
- [ ] Are there locator strategies used today besides CSS/XPath/ID (e.g., `By.NAME`, `By.TAG_NAME`)?
- [ ] Should locators support a `description` field for better error messages?
- [ ] Is `json.load()` per page instantiation a concern for large suites? (probably fine, but worth noting)

**Your notes:**
```
(write here)
```

---

## 4. Steps Layer Examples

The skill has two example steps classes:

| Class | Methods | Delegates to |
|---|---|---|
| `DeviceSteps` | `open_device()`, `verify_device_online()` | `DashboardPage`, `DevicesPage` |
| `RemoteControlSteps` | `set_frequency()`, `save_and_wait_reboot()`, `get_current_frequency()` | `RemoteControlMenu`, `RadioHelper` |

**Review questions:**
- [ ] Are these the right first steps classes to build? What workflows are most repeated in current tests?
- [ ] Should steps be provided as pytest fixtures (already defined in conftest) or instantiated in tests?
- [ ] Does `RemoteControlSteps` need device context (which device is selected)?
- [ ] Any missing steps classes? Suggestions for grouping (e.g., `NetworkingSteps`, `GPSSteps`, `SettingsSteps`)?

**Your notes:**
```
(write here)
```

---

## 5. Suite Organization

| Tier | Marker | When | Purpose |
|---|---|---|---|
| Smoke | `@pytest.mark.smoke` | Every PR / pre-merge | Fast gate |
| Regression | `@pytest.mark.regression` | Nightly | Full coverage |
| Release | `@pytest.mark.release` | Pre-release sign-off | RC validation |
| NFR | `@pytest.mark.nfr` | Nightly or on-demand | Performance |

Suite config files in `suites/` (e.g., `nightly_tsm.ini`, `smoke.ini`).

**Review questions:**
- [ ] Are these 4 tiers enough? Any need for `@pytest.mark.sanity` or a separate integration tier?
- [ ] Do nightly runs cover ALL waveforms or rotate? (skill assumes `nightly_all.ini` runs all)
- [ ] Is `smoke` realistic as a PR gate? How fast do smoke tests run? Is there CI to run them pre-merge?
- [ ] Are the existing 40+ markers all still relevant, or should some be consolidated?

**Your notes:**
```
(write here)
```

---

## 6. NFR / Performance Testing

The skill proposes:
- `Configuration/nfr_thresholds.json` with `max_seconds` per metric
- `KPICollector` fixture that records timings and asserts thresholds in teardown
- NFR test examples: dashboard load time, radio API response time

**Review questions:**
- [ ] Are the proposed thresholds realistic? (`3s` dashboard, `1s` radio GET, `60s` reboot)
- [ ] Is `KPICollector.assert_all()` in fixture teardown the right place? (test fails on teardown, not in the test body)
- [ ] Should NFR tests run against a specific radio/env, or are they environment-agnostic?
- [ ] Any other KPIs to track? (e.g., memory usage, radio throughput, page element count)

**Your notes:**
```
(write here)
```

---

## 7. ReportStack Integration

The skill documents:
- Launch naming convention: `{waveform}-{tier}-{build_version}`
- CLI flags: `--ar-url`, `--ar-launch-name`, `--ar-tags`, `--ar-auto-analyze`
- AI triage categories: `PRODUCT_BUG`, `AUTOMATION_BUG`, `SYSTEM_ISSUE`, `NO_DEFECT`, `TO_INVESTIGATE`
- `SYSTEM_ISSUE` covers radio hardware/firmware failures (no separate `RADIO_ISSUE`)

**Review questions:**
- [ ] Is the launch naming convention clear enough for the team?
- [ ] Should `--ar-tags` include the radio device hostname?
- [ ] Is the AI triage useful today, or is Ollama not yet deployed on twd00030?
- [ ] Any other metadata to capture per launch? (e.g., firmware version, TNC version)

**Your notes:**
```
(write here)
```

---

## 8. Jama Integration

The skill includes a full `JamaReporterPlugin` with:
- `JamaClient` class (REST API wrapper)
- Mapping file: `Configuration/jama_mapping.json`
- 3 test case categories: UI Testing, NFR, Radio Device Testing
- HTML result template per test run
- Trigger rules: Nightly + Release push to Jama; Smoke does not

**Review questions:**
- [ ] Is the Jama API version `/rest/v1/` confirmed? (skill has a verify note)
- [ ] Is API key auth correct, or does your Jama instance use OAuth / basic auth?
- [ ] Is the project key `TNC`? What's the actual Jama project ID?
- [ ] Are the 3 categories (UI Testing, NFR, Radio Device Testing) the right buckets, or should there be more/fewer?
- [ ] Do you want the HTML template to include screenshots or just text?
- [ ] Should the plugin also update existing test runs (re-runs), or always create new test cycles?
- [ ] Are the example TC IDs (`TC-1001`, `TC-2001`, `TC-3001`) placeholders you'll fill in, or does Jama use a different ID scheme?

**Your notes:**
```
(write here)
```

---

## 9. Jira Integration

The skill keeps Jira for **defect tracking only**:
- `pytest-jira` marker for known bugs: `@pytest.mark.jira("TNC-1234")`
- Defect flow: test fails → ReportStack AI categorizes → QA creates Jira issue manually

**Review questions:**
- [ ] Is `pytest-jira` already installed and configured in the current framework?
- [ ] Should the Jira project key be `TNC` or something else?
- [ ] Any desire to auto-create Jira issues from ReportStack in the future?
- [ ] Are Jira issues linked back in Jama test cases, or kept separate?

**Your notes:**
```
(write here)
```

---

## 10. Jenkins Pipeline

The skill includes a full `Jenkinsfile` with:
- Parameters: `RADIO_DEVICE`, `SUITE`, `BUILD_VERSION`, `PUBLISH_TO_JAMA`
- Docker run with `--network host` (reaches ReportStack at `localhost:8000`)
- Credentials: `AR_TOKEN`, `JAMA_API_KEY` from Jenkins secrets
- Pre-flight: `curl` to radio device API
- Post: Slack notification on failure

**Review questions:**
- [ ] Is `--network host` acceptable in your Jenkins environment? (security implications)
- [ ] Should multiple radio devices be testable in a single pipeline run? (currently single `RADIO_DEVICE` param)
- [ ] Is `appstestnw2-0.trellisware.com` the right default device?
- [ ] Is Slack the notification channel, or email, or both?
- [ ] Does the pipeline need a firmware version parameter?
- [ ] Should test results be archived as artifacts beyond JUnit XML?

**Your notes:**
```
(write here)
```

---

## 11. Directory Structure

The skill proposes a target directory layout with:
- New: `Locators/`, `Steps/`, `suites/`, `plugins/jama_reporter/`, `Test_Cases/NFR/`
- Refactored: `TNC/base_page.py`
- Updated: `Test_Cases/conftest.py`

**Review questions:**
- [ ] Does this match the actual current repo structure? Any directories missing or named differently?
- [ ] Is `Locators/` at the repo root OK, or should it be inside `TNC/`?
- [ ] Is `plugins/jama_reporter/` at the same level as `plugins/pytest-automation-reports/`?
- [ ] Any other directories or files that should be included?

**Your notes:**
```
(write here)
```

---

## 12. Migration Sequence (6 Phases)

```
Prerequisites → Phase 1 (Foundation) → Phase 2 (Steps) → Phase 3 (Suites) →
Phase 4 (NFR) → Phase 5 (Jama) → Phase 6 (Polish)
```

**Prerequisites** (cross-skill dependencies):
- LocalDiskStorage in ReportStack
- ReportStack deployed on twd00030
- Service account token for Jenkins
- pytest-automation-reports plugin installed

**Review questions:**
- [ ] Is this ordering right? Should any phases be swapped?
- [ ] Can Phase 3 (Suites) happen before Phase 2 (Steps)? Adding markers is independent of the steps layer.
- [ ] How many tests exist today? Is migrating them all to 4-layer realistic in one push, or should it be gradual?
- [ ] Who will do the migration work? Just you, or a team?
- [ ] Are the prerequisites all real blockers, or can some phases start without them?
- [ ] Is there a deadline or release target driving the migration?

**Your notes:**
```
(write here)
```

---

## 13. Missing Topics (things NOT in the skill yet)

These may or may not be needed — check if any should be added:

- [ ] **Parallel execution** — Can tests run in parallel (`pytest-xdist`)? Any shared state issues with radio devices?
- [ ] **Data-driven testing** — Are there parametrized tests? Should the skill cover `@pytest.mark.parametrize` patterns?
- [ ] **Test data management** — How are test configurations (device IPs, credentials, firmware versions) managed?
- [ ] **Environment management** — Multiple TNC instances (dev, staging, prod)? How does the framework handle switching?
- [ ] **Screenshot capture** — When are screenshots taken? Only on failure? The ReportStack plugin supports it, but the skill doesn't show how it hooks into TNC tests.
- [ ] **Logging strategy** — What level of logging do tests produce? How do logs reach ReportStack?
- [ ] **Error handling in page objects** — Custom exceptions? Retry on stale elements?
- [ ] **Browser lifecycle** — How is the WebDriver created/destroyed per test? Session scope or function scope?
- [ ] **Multi-radio testing** — Can one test run touch multiple radios? Or is it always 1 radio per run?
- [ ] **Version-specific locators** — The skill mentions swappable locators per TNC version, but doesn't show how version selection works.
- [ ] **conftest.py full example** — The skill shows `KPICollector` but not the full conftest with all fixtures (driver, steps, radio_helper, etc.)

**Your notes:**
```
(write here)
```

---

## 14. General Feedback

Use this space for anything that doesn't fit the sections above.

**What's good / keep as-is:**
```
(write here)
```

**What needs major changes:**
```
(write here)
```

**What's missing entirely:**
```
(write here)
```

**Priority order for implementation:**
```
(write here)
```

---

## How to Submit

1. Edit this file with your notes, checkboxes, and corrections
2. Save it
3. Tell Claude: "apply the review notes from architect-skill-review.md"
4. The actual `automation-architect-skill.md` will be updated based on your annotations
