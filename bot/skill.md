# ReportStack Framework Integration Skill

## Purpose

This document teaches an AI agent how to create test framework integrations (plugins/agents/listeners) for the **ReportStack** platform. By studying the existing pytest plugin and a real-world enterprise Java TestNG integration (Osprey Automation Tool), the agent can generate integration code for any test framework.

---

## ReportStack API Reference

All integrations communicate with the ReportStack backend via REST API at `{base_url}/api/v1`.

### Endpoints Used by Integrations

| Method | Endpoint | Purpose | Request Body |
|--------|----------|---------|-------------|
| `POST` | `/launches/` | Create a new launch (test run) | `{"name": "...", "description": "..."}` |
| `PUT` | `/launches/{id}/finish` | Finish launch with final status | `{"status": "PASSED\|FAILED\|STOPPED"}` |
| `POST` | `/launches/{id}/items/` | Report a single test result | `{"name", "suite", "status", "duration_ms", "error_message", "stack_trace"}` |
| `POST` | `/launches/{id}/items/batch` | Report multiple test results at once | `{"items": [...]}` |
| `POST` | `/launches/{id}/items/{item_id}/logs/batch` | Upload captured logs for a test | `{"logs": [{"level", "message", "timestamp"}]}` |
| `POST` | `/launches/{id}/items/{item_id}/attachments` | Upload screenshot/file (multipart) | `file` field, max 20MB |
| `POST` | `/launches/{id}/attachments` | Upload launch-level attachment | `file` field |
| `POST` | `/launches/{id}/analyze` | Trigger AI failure analysis | _(empty)_ |

### Status Values

- **LaunchStatus**: `IN_PROGRESS`, `PASSED`, `FAILED`, `STOPPED`
- **TestStatus**: `PASSED`, `FAILED`, `SKIPPED`, `ERROR`
- **LogLevel**: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`

---

## Integration Architecture Pattern

Every framework integration follows the same lifecycle:

```
┌─────────────────────────────────────────────────────────┐
│                   TEST FRAMEWORK                        │
│                                                         │
│  1. SESSION START  ──→  POST /launches/                 │
│     (create launch)     Response: { id: 42 }            │
│                                                         │
│  2. TEST START     ──→  Start timer, begin log capture  │
│     (per test)                                          │
│                                                         │
│  3. TEST END       ──→  POST /launches/42/items/        │
│     (per test)          { name, suite, status,           │
│                           duration_ms, error, trace }   │
│                     ──→  POST .../logs/batch             │
│                     ──→  POST .../attachments (if any)   │
│                                                         │
│  4. SESSION END    ──→  PUT /launches/42/finish          │
│     (finish launch)     { status: "FAILED" }            │
│                     ──→  POST /launches/42/analyze       │
│                          (if auto-analyze enabled)       │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Create launch once** at session/suite start, reuse the launch ID for all test items
2. **Report each test** with name, suite, status, duration, and failure details
3. **Capture logs** during test execution and batch-upload after each test
4. **Auto-screenshot on failure** if a browser/driver is available
5. **Finish launch** at session end with overall PASSED/FAILED status
6. **Optionally trigger AI analysis** for launches with failures
7. **Configuration via CLI args + environment variables** (URL, launch name, auto-analyze toggle)

---

## Reference Implementation: pytest Plugin

**Location**: `plugins/pytest-automation-reports/`

### File Structure

```
pytest_automation_reports/
├── __init__.py
├── plugin.py          # TestNG hooks → API calls
├── client.py          # HTTP client wrapper (ARClient)
├── config.py          # CLI option registration
├── log_capture.py     # logging.Handler for capturing logs
└── screenshot.py      # Selenium/Playwright screenshot utility
```

### client.py — HTTP Client (Reusable Pattern)

```python
class ARClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()

    def create_launch(self, name, description=None):
        resp = self.session.post(f"{self.base_url}/launches/",
            json={"name": name, "description": description})
        resp.raise_for_status()
        return resp.json()

    def finish_launch(self, launch_id, status):
        resp = self.session.put(f"{self.base_url}/launches/{launch_id}/finish",
            json={"status": status})
        resp.raise_for_status()
        return resp.json()

    def create_test_item(self, launch_id, data):
        resp = self.session.post(f"{self.base_url}/launches/{launch_id}/items/",
            json=data)
        resp.raise_for_status()
        return resp.json()

    def batch_create_logs(self, launch_id, item_id, logs):
        resp = self.session.post(
            f"{self.base_url}/launches/{launch_id}/items/{item_id}/logs/batch",
            json={"logs": logs})
        resp.raise_for_status()
        return resp.json()

    def upload_attachment(self, launch_id, item_id, filepath, filename):
        with open(filepath, "rb") as f:
            resp = self.session.post(
                f"{self.base_url}/launches/{launch_id}/items/{item_id}/attachments",
                files={"file": (filename, f)})
        resp.raise_for_status()
        return resp.json()

    def trigger_analysis(self, launch_id):
        resp = self.session.post(f"{self.base_url}/launches/{launch_id}/analyze")
        resp.raise_for_status()
```

### plugin.py — Framework Hooks (pytest-specific)

```python
class AutomationReportsPlugin:
    def __init__(self, config):
        self.client = ARClient(url)
        self.launch_id = None
        self.log_handler = LogCaptureHandler()
        self._start_times = {}
        self._has_failures = False

    # 1. SESSION START → Create launch
    def pytest_sessionstart(self, session):
        launch = self.client.create_launch(self.launch_name, self.launch_desc)
        self.launch_id = launch["id"]

    # 2. TEST START → Begin timer + log capture
    def pytest_runtest_setup(self, item):
        self.log_handler.reset()
        logging.getLogger().addHandler(self.log_handler)
        self._start_times[item.nodeid] = time.time()

    # 3. TEST END → Report result + logs + screenshots
    def pytest_runtest_teardown(self, item):
        # Calculate duration
        duration_ms = int((time.time() - start) * 1000)

        # Determine status from phase reports
        status = "PASSED"  # or "FAILED" or "SKIPPED"

        # Create test item
        test_item = self.client.create_test_item(self.launch_id, {
            "name": item.name,
            "suite": item.module.__name__,
            "status": status,
            "duration_ms": duration_ms,
            "error_message": error_message,
            "stack_trace": stack_trace,
        })

        # Upload captured logs
        self.client.batch_create_logs(self.launch_id, item_id, log_records)

        # Upload screenshots
        for screenshot_path in screenshots:
            self.client.upload_attachment(self.launch_id, item_id, path, filename)

    # 4. SESSION END → Finish launch + trigger AI
    def pytest_sessionfinish(self, session, exitstatus):
        self.client.finish_launch(self.launch_id, status)
        if self.auto_analyze and self._has_failures:
            self.client.trigger_analysis(self.launch_id)
```

---

## Reference: Enterprise Java TestNG Integration (Osprey)

This is a real-world enterprise framework that integrates with ReportPortal (similar to ReportStack). Study this to understand how large-scale Java TestNG frameworks work.

### Architecture

```
TestNG Framework
    ↓
OspreyReportPortalListener (extends BaseTestNGListener)
    ↓
OspreyReportPortalService (extends RPTestNGService)
    ↓
ReportPortal REST API (equivalent to ReportStack API)
```

### Test Inheritance Hierarchy

```
TestListenerAdapter (TestNG built-in)
    → BaseTest (oat-core library)
        → DTVNBaseTest (project-specific base)
            → Individual Test Classes (AppsTest, CDVRTest, etc.)
```

### Key Components

**Listener (entry point)**:
```java
// Registered in TestNG XML: <listener class-name="com.att.automation.rp.OspreyReportPortalListener"/>
public class OspreyReportPortalListener extends BaseTestNGListener {
    public OspreyReportPortalListener() {
        super(new OspreyReportPortalService());
    }
}
```

**Service (core integration logic)**:
```java
public class OspreyReportPortalService extends RPTestNGService {
    private ConcurrentHashMap<String, String> executionURLMap = new ConcurrentHashMap<>();
    private ConcurrentHashMap<String, String> failedTestAndScreenshotMap = new ConcurrentHashMap<>();

    @Override
    protected void finishTestMethod(ITestResult result) {
        // 1. Stop screen recording
        // 2. Get execution URL from ReportPortal
        // 3. Upload device logs
        // 4. Update confluence (for NFR tests)
        super.finishTestMethod(result);
    }

    @Override
    protected void sendReportPortalMsg(ITestResult result) {
        // On failure:
        // 1. Take screenshot
        // 2. Check for app crash via ADB logcat
        // 3. Upload device logs
        // 4. Emit log to ReportPortal with screenshot attachment
        File screenshot = takeScreenshot(driver);
        ReportPortal.emitLog(message, "ERROR", Calendar.getInstance().getTime(),
            new SaveLogRQ.File(screenshot));
    }

    @Override
    protected void finishLaunch(ITestResult result) {
        // Optional: auto-trigger AI triage
        super.finishLaunch(result);
    }
}
```

**Base Test Class (lifecycle hooks)**:
```java
public class DTVNBaseTest extends BaseTest {

    @BeforeSuite
    public void setUp() {
        // Discover devices, install apps, setup coverage, toggle feature flags
    }

    @BeforeMethod
    public void beforeMethod() {
        // Start screen recording, reset log handler
        super.beforeMethod();
    }

    @AfterMethod
    public void afterMethod() {
        // Extract code coverage, cleanup
        super.afterMethod();
    }

    @AfterSuite
    public void tearDown() {
        // Upload coverage archives, uninstall apps, power off devices
    }
}
```

**Test Class Example**:
```java
public class AppsTest extends DTVNBaseTest {

    @Test(dataProvider = OATDataProvider.OAT_DATA,
          dataProviderClass = OATDataProvider.class,
          groups = {"OVOSP-6185"})
    public void validateAppsCarousel(OATData oatData) {
        TestSetup testSetup = oatData.get(TestSetup.class);
        AppPage appsPage = oatData.get(AppPage.class);

        testSetup.goToApps();
        appsPage.waitUntilOnAppsTab();

        LOGGER.info("Checking Apps tab");
        Assert.assertTrue(appsPage.isOnAppsPage(), "Apps tab page does not load");
    }
}
```

**TestNG Suite XML**:
```xml
<suite name="AdvancedApps">
    <listeners>
        <listener class-name="com.att.automation.rp.OspreyReportPortalListener"/>
    </listeners>
    <parameter name="resetApp" value="true"/>
    <test name="NGC" parallel="methods">
        <classes>
            <class name="com.att.automation.AppsTest">
                <methods>
                    <include name="validateAppsCarousel"/>
                </methods>
            </class>
        </classes>
    </test>
</suite>
```

**AI Triage (post-launch analysis)**:
```java
public class ReportPortalAITriage {
    public void extractDataFromFailures() {
        // Query API for failed/skipped items
        // Extract error messages, stack traces
        // Filter noise from logs
    }

    public void getAITriageResults() {
        // Send failures to AI service
        // Returns: bug type + categorization message
        // Bug types: Product Bug, Automation Bug, System Issue, etc.
    }

    public void postTriageResultsToReportPortal() {
        // Map AI results to defect type IDs
        // Update test items with defect classification
    }
}
```

**Log4j2 → ReportPortal streaming**:
```xml
<Configuration>
    <Appenders>
        <ReportPortalLog4j2Appender name="ReportPortalAppender">
            <PatternLayout pattern="%logger{36} - %msg%n%throwable"/>
        </ReportPortalLog4j2Appender>
    </Appenders>
</Configuration>
```

**Maven Configuration (pom.xml)**:
```xml
<properties>
    <rp.endpoint>https://reportstack.example.com</rp.endpoint>
    <rp.api.key>your-api-key</rp.api.key>
    <rp.launch>RegressionRun</rp.launch>
    <rp.project>my-project</rp.project>
</properties>
```

---

## How to Create a New Framework Integration

### Step-by-step for any framework:

#### 1. Create an HTTP Client

Every integration needs a thin HTTP client that wraps the ReportStack API. Reuse the same endpoint structure:

| Language | HTTP Library |
|----------|-------------|
| Python | `requests` or `httpx` |
| Java | `HttpClient` (Java 11+) or `OkHttp` |
| JavaScript/TypeScript | `fetch` or `axios` |
| Go | `net/http` |
| C# | `HttpClient` |
| Ruby | `net/http` or `faraday` |

#### 2. Map Framework Lifecycle to ReportStack API

| Framework Hook | ReportStack API Call |
|---------------|---------------------|
| Suite/Session start | `POST /launches/` |
| Test start | Start timer, begin log capture |
| Test end | `POST /launches/{id}/items/`, `POST .../logs/batch`, `POST .../attachments` |
| Suite/Session end | `PUT /launches/{id}/finish`, `POST /launches/{id}/analyze` |

**Framework-specific hook mapping**:

| Framework | Session Start | Test Start | Test End | Session End |
|-----------|--------------|------------|----------|-------------|
| **pytest** | `pytest_sessionstart` | `pytest_runtest_setup` | `pytest_runtest_teardown` | `pytest_sessionfinish` |
| **TestNG** | `ITestListener.onStart(ISuite)` | `onTestStart(ITestResult)` | `onTestSuccess/Failure/Skipped` | `onFinish(ISuite)` |
| **JUnit 5** | `BeforeAllCallback` | `BeforeEachCallback` | `AfterEachCallback` | `AfterAllCallback` (via Extension) |
| **Jest** | `globalSetup` / custom reporter `onRunStart` | `onTestStart` | `onTestResult` | `onRunComplete` |
| **Mocha** | `runner.on('start')` | `runner.on('test')` | `runner.on('pass'/'fail')` | `runner.on('end')` |
| **Cypress** | `before()` / plugin `before:run` | `beforeEach()` | `afterEach()` | `after()` / plugin `after:run` |
| **Playwright** | Custom reporter `onBegin` | `onTestBegin` | `onTestEnd` | `onEnd` |
| **Robot Framework** | `start_suite` (listener) | `start_test` | `end_test` | `end_suite` / `close` |
| **RSpec** | `before(:suite)` / formatter `start` | `example_started` | `example_passed/failed` | `stop` / `close` |
| **Go testing** | `TestMain` | `t.Run` wrapper | deferred cleanup | `TestMain` exit |
| **NUnit** | `OneTimeSetUp` / custom attribute | `SetUp` | `TearDown` | `OneTimeTearDown` |
| **xUnit** | `IClassFixture` constructor | — | `Dispose` | `IClassFixture.Dispose` |
| **Cucumber** | `BeforeAll` hook | `Before` | `After` | `AfterAll` |

#### 3. Handle Status Mapping

Map framework-specific statuses to ReportStack statuses:

```
Framework result → ReportStack status
─────────────────────────────────────
pass/success      → PASSED
fail/failure      → FAILED
skip/pending      → SKIPPED
error/abort       → ERROR
timeout           → FAILED (with error_message noting timeout)
```

#### 4. Capture Failure Details

On test failure, extract:
- **error_message**: First line of the exception/assertion message
- **stack_trace**: Full stack trace / failure representation
- **screenshot**: If a browser/driver/page is available, capture and upload

#### 5. Log Capture Strategy

| Framework | Log Capture Approach |
|-----------|---------------------|
| Python (pytest) | Custom `logging.Handler` attached during test |
| Java (TestNG) | Log4j2 Appender or SLF4J interceptor |
| JavaScript | Console interceptor or custom logger |
| Go | Custom `io.Writer` for `log` package |

Each log entry needs: `level` (TRACE/DEBUG/INFO/WARN/ERROR), `message`, `timestamp` (ISO 8601).

#### 6. Configuration

Every integration should accept these settings via CLI args AND environment variables:

| Setting | CLI Example | Env Var | Required |
|---------|-------------|---------|----------|
| ReportStack URL | `--ar-url` | `AR_URL` | Yes |
| Launch name | `--ar-launch-name` | `AR_LAUNCH_NAME` | No (default: framework name) |
| Launch description | `--ar-launch-description` | `AR_LAUNCH_DESCRIPTION` | No |
| Auto-analyze | `--ar-auto-analyze` | `AR_AUTO_ANALYZE` | No (default: false) |

---

## Example: Java TestNG Agent for ReportStack

Here's how you would build a TestNG integration based on the patterns above:

### ReportStackClient.java

```java
public class ReportStackClient {
    private final String baseUrl;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();

    public ReportStackClient(String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/$", "");
    }

    public int createLaunch(String name, String description) throws Exception {
        var body = json.writeValueAsString(Map.of(
            "name", name, "description", description));
        var req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/launches/"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        var resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        return json.readTree(resp.body()).get("id").asInt();
    }

    public void finishLaunch(int launchId, String status) throws Exception {
        var body = json.writeValueAsString(Map.of("status", status));
        var req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/launches/" + launchId + "/finish"))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();
        http.send(req, HttpResponse.BodyHandlers.ofString());
    }

    public int createTestItem(int launchId, Map<String, Object> data) throws Exception {
        var body = json.writeValueAsString(data);
        var req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/launches/" + launchId + "/items/"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        var resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        return json.readTree(resp.body()).get("id").asInt();
    }

    public void batchCreateLogs(int launchId, int itemId, List<Map<String, Object>> logs) throws Exception {
        var body = json.writeValueAsString(Map.of("logs", logs));
        var req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/launches/" + launchId + "/items/" + itemId + "/logs/batch"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        http.send(req, HttpResponse.BodyHandlers.ofString());
    }

    public void triggerAnalysis(int launchId) throws Exception {
        var req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/launches/" + launchId + "/analyze"))
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
        http.send(req, HttpResponse.BodyHandlers.ofString());
    }
}
```

### ReportStackListener.java

```java
public class ReportStackListener implements ITestListener, ISuiteListener {
    private ReportStackClient client;
    private int launchId;
    private boolean hasFailures = false;
    private final ConcurrentHashMap<String, Long> startTimes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<Map<String, Object>>> logBuffers = new ConcurrentHashMap<>();

    @Override
    public void onStart(ISuite suite) {
        String url = System.getProperty("ar.url", System.getenv("AR_URL"));
        String name = System.getProperty("ar.launch.name", suite.getName());
        String desc = System.getProperty("ar.launch.description", "");
        client = new ReportStackClient(url);
        try {
            launchId = client.createLaunch(name, desc);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create launch", e);
        }
    }

    @Override
    public void onTestStart(ITestResult result) {
        String key = result.getMethod().getQualifiedName();
        startTimes.put(key, System.currentTimeMillis());
        logBuffers.put(key, Collections.synchronizedList(new ArrayList<>()));
    }

    @Override
    public void onTestSuccess(ITestResult result) { reportResult(result, "PASSED"); }

    @Override
    public void onTestFailure(ITestResult result) { hasFailures = true; reportResult(result, "FAILED"); }

    @Override
    public void onTestSkipped(ITestResult result) { reportResult(result, "SKIPPED"); }

    private void reportResult(ITestResult result, String status) {
        String key = result.getMethod().getQualifiedName();
        long duration = System.currentTimeMillis() - startTimes.getOrDefault(key, System.currentTimeMillis());

        String errorMessage = null, stackTrace = null;
        if (result.getThrowable() != null) {
            errorMessage = result.getThrowable().getMessage();
            StringWriter sw = new StringWriter();
            result.getThrowable().printStackTrace(new PrintWriter(sw));
            stackTrace = sw.toString();
        }

        try {
            int itemId = client.createTestItem(launchId, Map.of(
                "name", result.getMethod().getMethodName(),
                "suite", result.getTestClass().getName(),
                "status", status,
                "duration_ms", duration,
                "error_message", errorMessage != null ? errorMessage : "",
                "stack_trace", stackTrace != null ? stackTrace : ""
            ));

            List<Map<String, Object>> logs = logBuffers.remove(key);
            if (logs != null && !logs.isEmpty()) {
                client.batchCreateLogs(launchId, itemId, logs);
            }
        } catch (Exception e) {
            System.err.println("Failed to report test: " + e.getMessage());
        }
    }

    @Override
    public void onFinish(ISuite suite) {
        String status = hasFailures ? "FAILED" : "PASSED";
        try {
            client.finishLaunch(launchId, status);
            boolean autoAnalyze = Boolean.parseBoolean(
                System.getProperty("ar.auto.analyze",
                    System.getenv().getOrDefault("AR_AUTO_ANALYZE", "false")));
            if (autoAnalyze && hasFailures) {
                client.triggerAnalysis(launchId);
            }
        } catch (Exception e) {
            System.err.println("Failed to finish launch: " + e.getMessage());
        }
    }
}
```

### Usage in testng.xml

```xml
<suite name="My Tests">
    <listeners>
        <listener class-name="com.example.reportstack.ReportStackListener"/>
    </listeners>
    <test name="Regression">
        <classes>
            <class name="com.example.tests.LoginTest"/>
        </classes>
    </test>
</suite>
```

### Usage via Maven

```xml
<systemPropertyVariables>
    <ar.url>http://localhost:8000/api/v1</ar.url>
    <ar.launch.name>Regression Suite</ar.launch.name>
    <ar.auto.analyze>true</ar.auto.analyze>
</systemPropertyVariables>
```

---

## Lessons from Enterprise Integration (Osprey)

Key patterns observed in a production enterprise framework:

1. **Thread safety matters**: Use `ConcurrentHashMap` for test data tracking in parallel execution
2. **Multi-layer failure capture**: Screenshot + device logs + app crash detection + ADB logcat
3. **Log filtering**: Exclude noise (post-test steps, upload statements) from AI analysis input
4. **Graceful degradation**: If reporting fails, log the error but don't fail the test
5. **Configuration hierarchy**: System properties → environment variables → defaults
6. **Real-time streaming**: Logs sent to reporting server during execution (via Log4j2 appender), not just at end
7. **Post-launch automation**: AI triage runs automatically after launch completes
8. **Suite-level listeners**: Register once in XML, applies to all tests
9. **Device/resource management**: @BeforeSuite/@AfterSuite for expensive setup/teardown (device pools, coverage, APK install)
10. **Execution recording**: Screen recording per test method for failure investigation
---
name: automation-cicd-twd00030
description: Set up, deploy, troubleshoot, or extend the CI/CD pipeline and Automation Reports web app on Linux host twd00030. Use this skill whenever the user asks about Jenkins setup, the pytest automation framework, the Reports app deployment, Docker Compose configuration, the integration between Jenkins and the Reports app, or any infrastructure on this specific Linux machine. Trigger on phrases like "the pipeline", "Jenkins", "the reports app", "automation framework", "deploy", "twd00030", or any mention of test reporting infrastructure.
---

# Automation CI/CD + Reports App on twd00030

## Project overview

This project consists of two integrated systems running on a single Linux host:

1. **CI/CD pipeline** — Jenkins orchestrates a pytest-based automation framework. Jenkins pulls code from GitHub, builds a Docker image with the framework, runs the test suite in that container, and reports results.
2. **Automation Reports web app** — A self-hosted ReportPortal-style platform (FastAPI + React + Postgres) that receives test results from the pytest framework via a custom plugin (`pytest-automation-reports`) and presents them to users.

The two systems run on the same Linux machine (`twd00030`) and connect over the local Docker network.

## Host environment

```
Hostname:      twd00030
IP:            172.16.64.129/21 (eno1)
OS:            Ubuntu 24.04.4 LTS
Kernel:        Linux 6.17.0-22-generic x86_64
CPU:           Intel Core i5-14500, 20 cores
RAM:           15 GiB total (~11 GiB available)
Swap:          4 GiB
Disk:          233 GB root (170 GB free)
NFS mounts:    /misc/mirrors (4.5T, 93% full — shared, do not store here)
               /tools (413G, 72% full)
               /misc/IT (201G, 1% full — usable for backups)
User:          rjafarzade (member of docker group)
```

## Stack — installed and confirmed working

| Component | Version | Notes |
|---|---|---|
| Docker Engine | 29.4.1 | Already running |
| Docker Compose | v2.x | Use `docker compose ...` (space, not hyphen) |
| Git | 2.43.0 | |
| Python | 3.12.3 | Matches backend requirement |
| Node.js | 25.5.0 | |
| npm | 11.8.0 | |
| Build tools | gcc 13.3, make 4.3 | |
| utilities | curl, wget, jq, unzip | |

Java is NOT installed on the host. This is correct — Jenkins runs in a Docker container with its own JDK. Do not install Java on the host.

The legacy `docker-compose` v1 (Python tool, version 1.29.2) may still be present. Always use `docker compose` (v2 syntax) instead. If you see hyphenated form in docs, mentally translate.

## Currently running

- **Jenkins**: `jenkins/jenkins:lts` container, ports 8080 (UI) + 50000 (agent), volume `jenkins_home`. Up for 7+ days at last check.
- Nothing else.

## Network ports in use on host

| Port | Service | Bind |
|---|---|---|
| 22 | SSH | 0.0.0.0 |
| 8080 | Jenkins UI | 0.0.0.0 |
| 50000 | Jenkins agent | 0.0.0.0 |
| 3389 | RDP | * |
| 9090 | (unknown — investigate if needed) | * |

**Reserved for Reports app deployment:**
- 8000 → FastAPI backend
- 3000 → React frontend (via nginx)

**Internal-only (no host port mapping):**
- Postgres (Docker network only, port 5432 inside)
- Ollama (deferred — see below)

## Key decisions (with reasoning)

### Ollama / AI analysis is DEFERRED
The Reports app design includes an `/api/v1/analyze` endpoint backed by Ollama running `mistral:7b`. **Do not deploy Ollama on this host.** Reasoning: mistral:7b consumes 5–6 GiB RAM during inference, which leaves no headroom on a 15 GiB box once Jenkins, Postgres, backend, frontend, and a test-runner container are also running.

Implementation pattern: backend ships with `AI_ANALYSIS_ENABLED=false` env flag. The `/analyze` endpoint returns a graceful "not configured" response. When stronger hardware is available later, flip the flag and add the Ollama service to compose — no code changes needed.

If AI analysis is actually needed before hardware upgrade: point `OLLAMA_BASE_URL` at a hosted LLM API (Anthropic, OpenAI) instead of self-hosting.

### Reverse proxy / TLS handled by company internal proxy
No Caddy/Traefik/nginx-edge-proxy needed on this host. The company has an internal proxy that will:
- Terminate TLS
- Map hostnames like `jenkins.<company>.internal` → `twd00030:8080`
- Map `reports.<company>.internal` → `twd00030:3000`
- Pass plain HTTP to the host

Action item: an IT request must be filed to set up the hostnames and confirm GitHub webhook reachability for `jenkins.<company>.internal/github-webhook/`.

### Both systems on one machine — for now
Jenkins and the Reports app share the host. Acceptable while RAM is sufficient. Plan: monitor RAM headroom; if it tightens, the Reports app is a clean candidate for a second box.

### Storage: local Docker volumes, backed up to NFS
- Postgres data: named volume `postgres_data` (local NVMe disk)
- Test attachments: named volume `attachments` (local NVMe disk)
- Backups: scheduled `restic` snapshots to `/misc/IT` (NFS, 200 GB free)

Do NOT bind-mount data directories from `/misc/mirrors` or other shared NFS — performance and concurrency issues. Local volumes only; back them up to NFS.

### Development model: Mac → Linux
Reports app code is developed on a personal Mac (likely Apple Silicon / arm64) and cloned to twd00030 (amd64) for deployment. Implications:
- Use multi-arch base images in Dockerfiles (`python:3.12-slim`, `node:20-alpine`, `postgres:16-alpine` are all multi-arch)
- Don't push `:arm64` images from Mac; build on Linux
- Pin all image versions exactly (`postgres:16.4-alpine`, never `:latest`)
- Add `.gitattributes` enforcing `eol=lf`
- `.dockerignore` includes `.DS_Store` and `__pycache__`

## Architecture diagram (text form)

```
                    [GitHub repo]
                         │
                         │ webhook (or poll)
                         ▼
              ┌──────────────────────┐
              │  twd00030 (Linux)    │
              │                      │
              │  ┌─────────────┐     │
              │  │   Jenkins   │     │   :8080 (host)
              │  │  (running)  │     │
              │  └──────┬──────┘     │
              │         │ docker run │
              │         ▼            │
              │  ┌─────────────┐     │
              │  │ pytest+plugin│   │   ephemeral
              │  │  container   │   │
              │  └──────┬──────┘     │
              │         │ POST results│
              │         ▼            │
              │  ┌─────────────────┐ │
              │  │ Reports App     │ │
              │  │  ┌──────────┐   │ │
              │  │  │ Frontend │───┼─┼─→ :3000 (host)
              │  │  └────┬─────┘   │ │
              │  │       │         │ │
              │  │  ┌────▼─────┐   │ │
              │  │  │ Backend  │───┼─┼─→ :8000 (host)
              │  │  └────┬─────┘   │ │
              │  │       │         │ │
              │  │  ┌────▼─────┐   │ │
              │  │  │ Postgres │   │ │   internal only
              │  │  └──────────┘   │ │
              │  │                 │ │
              │  │  [Ollama TBD]   │ │
              │  └─────────────────┘ │
              └──────────────────────┘
                         │
                         ▼
                [Company internal proxy]
                         │
                         ▼
                    Internal users
```

## Standard `docker-compose.yml` for the Reports app

The version of compose to use when deploying the Reports app stack. Lives in the cloned project repo on twd00030.

```yaml
services:
  db:
    image: postgres:16.4-alpine
    container_name: reports-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: reports-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      AI_ANALYSIS_ENABLED: "false"
      ATTACHMENT_PATH: /data/attachments
    volumes:
      - attachments:/data/attachments
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      retries: 5

  frontend:
    build: ./frontend
    container_name: reports-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "3000:80"

volumes:
  postgres_data:
  attachments:
```

## Common operations

### Inspect what's running
```bash
docker ps                               # running containers
docker ps -a                            # all containers
docker volume ls                        # all volumes
docker images                           # all images
df -h /                                 # host disk
free -h                                 # host RAM
```

### Reports app lifecycle (when deployed)
```bash
cd ~/projects/reports-app
docker compose up -d --build            # bring up / rebuild
docker compose logs -f backend          # tail backend logs
docker compose exec backend bash        # shell into backend
docker compose exec backend alembic upgrade head    # run migrations
docker compose exec db psql -U $POSTGRES_USER $POSTGRES_DB    # psql
docker compose down                     # stop (keeps volumes)
docker compose down -v                  # stop AND delete volumes (DESTRUCTIVE)
```

### Jenkins
```bash
docker logs jenkins -f                  # tail logs
docker exec -it jenkins bash            # shell in
docker restart jenkins                  # restart
```

### Backup `jenkins_home` (critical — Jenkins config lives there)
```bash
# Quick tar snapshot
docker run --rm -v jenkins_home:/data -v /misc/IT/backups:/backup alpine \
  tar czf /backup/jenkins_home-$(date +%Y%m%d).tar.gz -C /data .

# Better: restic to /misc/IT (set up once)
restic -r /misc/IT/backups/jenkins init
restic -r /misc/IT/backups/jenkins backup /var/lib/docker/volumes/jenkins_home
```

### Postgres backup (when Reports app is deployed)
```bash
docker compose exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB | \
  gzip > /misc/IT/backups/reports-db-$(date +%Y%m%d).sql.gz
```

### Disk reclaim
```bash
docker image prune -a                   # remove unused images (asks confirm)
docker volume prune                     # remove unused volumes (asks confirm)
docker system prune -a --volumes        # nuclear: removes everything unused
```

## Cleanup completed (do not redo)

These were removed as part of project setup; do not recreate unless the kestrelportal project is revived:

- Containers: `kestrel-minio`, `kestrel-postgres`, `kestrel-redis`, `postgres-db`, several `tacman:latest` containers (loving_mendel, inspiring_newton, etc.)
- Volumes: `kestrelportal_minio_data`, `kestrelportal_postgres_data`, `kestrelportal_redis_data`
- Images: old `tacman:latest` (1.29 GB each), MinIO, redis:7-alpine, postgres:16 (kept :16-alpine)

## GitHub integration (Jenkins side)

Jenkins needs credentials to clone GitHub repos and post status checks back to PRs. Two options:

1. **GitHub App** (preferred): create at GitHub → Settings → Developer settings → GitHub Apps. Install on the org/repo. Add credentials to Jenkins as type "GitHub App."
2. **Personal Access Token (PAT)**: simpler but tied to a user account. Add to Jenkins as a "Username with password" or "Secret text" credential.

Webhook URL Jenkins expects: `https://<jenkins-host>/github-webhook/`

If GitHub.com cannot reach the Jenkins URL through the company proxy, fall back to polling SCM (`pollSCM('H/5 * * * *')`) — works everywhere, ~5 minute trigger delay.

## Reference Jenkinsfile

Lives in the pytest framework repo, not the Reports app repo:

```groovy
pipeline {
    agent any
    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }
    environment {
        IMAGE_TAG = "automation-fw:${env.BUILD_NUMBER}"
        REPORTS_API_URL = "http://reports-backend:8000"
    }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Build image') {
            steps { sh 'docker build -t $IMAGE_TAG .' }
        }
        stage('Run tests') {
            steps {
                withCredentials([string(credentialsId: 'REPORTS_API_TOKEN', variable: 'REPORTS_API_TOKEN')]) {
                    sh '''
                        docker run --rm \
                          --network reports-app_default \
                          -e REPORTS_API_URL=$REPORTS_API_URL \
                          -e REPORTS_API_TOKEN=$REPORTS_API_TOKEN \
                          -v $WORKSPACE/reports:/app/reports \
                          $IMAGE_TAG \
                          pytest -n auto \
                                 --junitxml=reports/junit.xml \
                                 --automation-reports
                    '''
                }
            }
        }
    }
    post {
        always { junit 'reports/junit.xml' }
        failure {
            slackSend channel: '#qa-alerts', color: 'danger',
                message: "Build failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
        cleanup { sh 'docker rmi $IMAGE_TAG || true' }
    }
}
```

The `--network reports-app_default` lets the test runner POST results directly to the backend by service name. Confirm the actual network name with `docker network ls` after the Reports app is up.

## Open / TODO items

- [ ] Confirm Jenkins → GitHub connection works end-to-end (credentials + webhook OR polling)
- [ ] Verify Jenkins has a working pipeline against the pytest framework (even just `pytest --collect-only`)
- [ ] File IT request for hostnames `jenkins.<company>.internal` and `reports.<company>.internal`, plus inbound webhook path
- [ ] Confirm GitHub webhook reachability (or commit to polling)
- [ ] Reports app code: still in development on Mac
- [ ] Clone Reports app to twd00030 once code is ready (`~/projects/reports-app/`)
- [ ] Implement `pytest-automation-reports` plugin and integrate with Jenkinsfile
- [ ] Write `Dockerfile` for backend (Python 3.12-slim base)
- [ ] Write `Dockerfile` for frontend (multi-stage: node:20-alpine build → nginx:1.27-alpine serve)
- [ ] Write `Makefile` with common operations (build/up/down/logs/migrate/seed/backup)
- [ ] Set up restic backup schedule for `jenkins_home`, `postgres_data`, `attachments` → `/misc/IT/backups`
- [ ] Install Portainer for visual container management (optional)
- [ ] Decide attachment storage strategy long-term (local vs MinIO vs S3 vs NFS)
- [ ] Add Ollama service to compose if/when stronger hardware available

## Gotchas / things that have bitten or will bite

1. **Don't run `~/system-inventory.txt` directly** — text files aren't executable. Use `cat ~/system-inventory.txt` to view.
2. **`docker-compose` (v1) vs `docker compose` (v2)** — always use the v2 form. The v1 alias is deprecated.
3. **Port 8080 is taken** by Jenkins — the Reports app frontend uses 3000, backend uses 8000. Don't reassign.
4. **Mac (arm64) → Linux (amd64) image differences** — use multi-arch base images, don't push platform-specific tags.
5. **Postgres should never be exposed** on the host — keep `ports:` unset for the db service. Backend connects via Docker network using the service name `db`.
6. **`.env` files are never committed** — only `.env.example` with placeholders. Real credentials go on each host manually.
7. **Healthchecks matter** — without them, `depends_on` only waits for container start, not for the service to be ready. Backend will try to connect to a not-yet-ready Postgres and crash.
8. **Ollama model is NOT baked into the image** — even if the service is added later, `ollama pull mistral:7b` (or whichever model) must be re-run after volume recreation. Persist the Ollama models volume.
9. **Test attachments grow fast** — set retention policies and monitor `attachments` volume size from week one.
10. **`/misc/mirrors` is 93% full and shared** — do not write project data there. Use `/misc/IT` for backups (it has 200 GB free).
11. **Hardware Java reports as missing** — that's correct. Jenkins ships its own JDK in the container.

## Recommended deploy sequence (when Reports app is ready)

1. Confirm cleanup is done and disk has space (`df -h /`, expect 170+ GB free)
2. SSH key set up between rjafarzade@twd00030 and GitHub for cloning
3. `cd ~/projects && git clone <reports-app-repo-url>`
4. `cd reports-app && cp .env.example .env && nano .env` (set real credentials)
5. `docker compose build` — first build is slow, subsequent are cached
6. `docker compose up -d`
7. `docker compose ps` — confirm all services show `healthy`
8. `docker compose exec backend alembic upgrade head` — DB migrations
9. `curl http://localhost:8000/health` — should return 200
10. `curl http://localhost:3000` — should return frontend HTML
11. Configure Jenkinsfile to POST to `http://reports-backend:8000` via Docker network
12. Run pipeline, confirm test results appear in Reports UI
13. Schedule restic backups
14. File IT request for proxy hostnames if not yet done
15. Mark project deployed; switch to maintenance mode

## When to load this skill

Read this file when:
- Setting up, modifying, or debugging anything on `twd00030`
- Working on Jenkins jobs, the pytest framework, or its Docker image
- Working on the Automation Reports backend, frontend, database, or compose config
- Discussing storage, backups, or capacity planning for this project
- Asked about decisions that were made (Ollama deferred, single-box deployment, etc.)
- Filing or reviewing IT requests related to this project

Do not load this skill for:
- General Jenkins/Docker/FastAPI questions unrelated to this project
- Other projects on other hosts
