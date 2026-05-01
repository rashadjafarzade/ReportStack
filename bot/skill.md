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
