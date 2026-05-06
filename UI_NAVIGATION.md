# UI Navigation — ReportStack

> Detailed companion to `CLAUDE.md` §6.7. Documents the user-facing
> drill-down flow: from sidebar entry points all the way to the log
> view, with breadcrumbs, status strips, tabs, and the defect-selection
> workflow. Modeled on ReportPortal's hierarchy
> ([demo.reportportal.io](https://demo.reportportal.io)) so any developer
> who's used RP can find their way around ReportStack without surprises.
>
> Authoritative source for the navigation spec. When the code and this
> doc disagree, fix whichever is wrong — but they should never disagree.

---

## 1. URL Hierarchy

| URL | Page Component | Purpose |
|---|---|---|
| `/login` | `Login.tsx` | Authentication (login + register) |
| `/` | `Layout.tsx` | Sidebar shell, redirects to `/dashboard` |
| `/dashboard` | `Dashboards.tsx` | All Dashboards (list view) |
| `/dashboard/:id` | `DashboardDetail.tsx` | Single Dashboard with widgets |
| `/launches` | `LaunchList.tsx` | All Launches (filterable list) |
| `/launches/:launchId` | `LaunchDetail.tsx` | Suite/test list within a launch |
| `/launches/:launchId/items/:itemId` | `SuiteDetail.tsx` / `TestDetail.tsx` | Polymorphic — renders SuiteDetail if children exist, TestDetail if leaf |
| `/launches/:launchId/items/:itemId/log` | `TestDetail.tsx` (logs tab) | Terminal node — logs, stack trace, attachments |
| `/members` | `Members.tsx` | Project members CRUD |
| `/settings` | `Settings.tsx` | Project settings (9 tabs — see CLAUDE.md §6.5) |
| `/profile` | `Profile.tsx` | Current user profile + theme switcher |

---

## 2. Sidebar (always visible after login)

Width: 240px. Background: `--color-sidebar-bg` (dark navy, brand-aligned).

### Sections

```
┌─────────────────────────┐
│  [LOGO TILE]            │  ← 36×36 brand-gradient tile + ReportStack
│  Project Name           │     wordmark
├─────────────────────────┤
│  ▶  Dashboard           │  ← navigates to /dashboard
│  ▶  Launches            │  ← navigates to /launches
├─ PROJECT ──────────────┤
│  👥  Members            │
│  ⚙   Settings           │
└─────────────────────────┘
                ↓ bottom
        ┌──────────────┐
        │ User Avatar  │     ← navigates to /profile
        │ user@email   │
        └──────────────┘
```

Active link: 3px `--color-primary-active` left stripe via `::before`,
`--color-primary-soft` background tint.

---

## 3. Dashboards Flow

### 3.1 Dashboard List (`/dashboard`)

| Element | Behavior |
|---|---|
| Page title | "All Dashboards" |
| Search by name | Live filter, debounced |
| Grid / List view toggle | Top-right; persists in `localStorage`-equivalent React state |
| **Add New Dashboard** button | Top-right; opens create modal |
| Row | Name, Description, Owner, Duplicate, Edit, Delete actions |
| Pagination | "1 - N of M" + per-page selector at bottom right |

Click row → navigates to `/dashboard/{id}`.

### 3.2 Dashboard Detail (`/dashboard/:id`)

| Element | Behavior |
|---|---|
| Breadcrumb | `ALL DASHBOARDS / <DASHBOARD NAME>` |
| **Add new widget** button | Opens widget picker modal |
| **Lock / Edit / Full screen / Delete / Print** buttons | Top-right toolbar |
| Widget grid | React-grid-layout style; widgets stack/wrap |

**Widget types (modeled on ReportPortal):**
- Launch Statistics Area (line/area chart of pass/fail/skipped over time)
- Launch Statistics Bar (stacked bar per launch)
- Investigated Percentage of Launches (% investigated vs to-investigate)
- Most Failed Tests (list of top-N failing tests across recent launches)
- Pass rate trend (single line chart)
- Status pie (PB/AB/SI/ND/TI breakdown for current period)

Each widget has its own legend, color-coded to defect tokens
(`--color-pb`, `--color-ab`, etc.) and status tokens.

---

## 4. Launches Flow

### 4.1 Launch List (`/launches`)

The most-used page in the app. Heavy filtering, paginated rows.

#### Header

| Element | Behavior |
|---|---|
| **ALL LAUNCHES / Latest launches** dropdown | Toggle scope (all history vs. latest per name) |
| **Add filter** | Opens filter modal (status, tag, date range, name contains, attribute key=value) |
| **Import** | Upload junit.xml / launch JSON |
| **Actions ▾** | Bulk actions on selected rows: Merge, Compare, Delete, Move, Force finish |
| **Refresh** | Re-fetches list (or use auto-poll, every 15s) |

#### Row Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ☰  Demo API Tests #20                                3 hours ago            │
│      ◇ N/A  ⏱ 6s  👤 default  🏷 platform: debian  build: 3.6.15.59.41  demo │
│      Demonstration launch.                                                   │
│      A typical Launch structure comprises…                                   │
│                                                                              │
│      [Total] [Passed] [Failed] [Skipped] [PB] [AB] [SI] [TI]   [☐ select]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Column | Content |
|---|---|
| ☰ | Drag handle (reorder, future) |
| **NAME** | Launch name + `#` number, click to drill in |
| Subtext | Status badge, duration, owner, tags, build version |
| Description | First 1-2 lines of `launch.description`, expandable |
| **START TIME** | Relative timestamp, sortable, click toggles asc/desc |
| **TOTAL / PASSED / FAILED / SKIPPED** | Counts (linked — clicking filters the launch detail) |
| **PRODUCT BUG / AUTO BUG / SYSTEM ISSUE / TO INVESTIGATE** | Donut indicator with count overlay, color matches defect token |
| ☐ | Multi-select checkbox (enables Actions menu) |

Click launch name → navigates to `/launches/{launchId}` (LaunchDetail).

#### Filtering

The "Add filter" UI lets users build composable filters. Each filter is a
chip displayed below the header. Active filter set persists in URL query
string so views are shareable.

Standard filter operators:
- `cnt` — contains
- `!cnt` — doesn't contain
- `eq` / `!eq` — equals / not equals
- `>` / `<` / `>=` / `<=` — range (for numeric/date)
- `in` — value in list

---

### 4.2 Launch Detail (`/launches/:launchId`)

User landed here from clicking a launch name. They're now drilling INTO
that launch.

#### Header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⇕  ALL  ›  Demo API Tests #18                  ⏱ 6s 👤 ✦ 💬   Actions ▾  ⟳ │
├──────────────────────────────────────────────────────────────────────────────┤
│  ☰ LIST VIEW   🚫 UNIQUE ERRORS   📄 LOG VIEW   🕒 HISTORY                   │
│                            Passed 80.00%  Total: 25                          │
│                       PB 4   AB 1   SI 0   ND 0   TI 1                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Breadcrumb:** `All > Demo API Tests #18`. The "All" segment links back
to `/launches`. Clickable, uses `.breadcrumb` classes.

**Top-right metadata strip:** duration ⏱, owner 👤, attachment indicator ✦,
comment indicator 💬. Hover for details.

#### Tabs

| Tab | Behavior |
|---|---|
| **LIST VIEW** | Default. Table of suites/tests with REFINE filter (Suite name contains) |
| **UNIQUE ERRORS** | Group failures by normalized error message (collapse near-duplicates) |
| **LOG VIEW** | Flat log stream across all tests in this launch, filtered by level |
| **HISTORY** | Per-test trend across past launches (pass/fail timeline) |

#### Status Strip

The five-letter convention from CLAUDE.md §6.7. Each badge is a button —
clicking it filters the body to that defect type only.

#### Body — LIST VIEW (default)

Table columns identical to LaunchList counts (NAME, START TIME, TOTAL,
PASSED, FAILED, SKIPPED, PB, AB, SI, TI), but the rows are now **suites**
within this launch.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Suite with retries                                3 hours ago      1   1    │
│    ⏱ 0.55s  🏷 longest, most failed, flaky                                   │
│    This is demonstration description. This root-item contains automatically  │
│    generated test cases with logs and attachments.                           │
│                                                                              │
│  Suite with nested steps                           3 hours ago      1   1    │
│    ⏱ 1s  🏷 longest, most failed, most stable                                │
│    This is a suite level. Here you can handle the aggregated information…   │
│                                                                              │
│  beforeSuite                                       3 hours ago               │
│    ⏱ 0.06s                                                                   │
│                                                                              │
│  Filtering Launch Tests                            3 hours ago      8   8    │
│    ⏱ 1s  🏷 longest, most failed, most stable                                │
│    Here could be very important information about test-cases that are inside.│
└──────────────────────────────────────────────────────────────────────────────┘
```

Click a suite row → `/launches/{launchId}/items/{itemId}` (SuiteDetail).

---

### 4.3 Suite Detail (`/launches/:launchId/items/:itemId`)

Same shell as LaunchDetail but breadcrumb extends:

```
All > Demo API Tests #18 > Suite with retries
```

Same tabs (LIST VIEW / UNIQUE ERRORS / LOG VIEW / HISTORY). Same status
strip. Body shows **test cases** within this suite.

For a flat suite (only leaves underneath), the body is the same table but
the rows are tests, not sub-suites. For deeply nested suites, the same
SuiteDetail page recurses with breadcrumb getting longer.

---

### 4.4 Test Case Detail (`/launches/:launchId/items/:itemId`)

Breadcrumb extends again:

```
All > Demo API Tests #18 > Suite with retries > First test case
```

Body changes — the table columns are now:

| Column | Content |
|---|---|
| Method-type toggle | Switch between "Test methods only" and "All methods (incl. before/after)" |
| **METHOD TYPE** | Test, BeforeMethod, AfterMethod, etc. |
| **NAME** | Test name + status pill + duration + tags + retry indicator |
| **STATUS** | Failed / Passed / Skipped (text + dropdown to override) |
| **START TIME** | Relative |
| **ANALYSIS OWNER** | Who triaged (system / user email) |
| **DEFECT TYPE** | Pill: Product Bug / Automation Bug / etc. |
| ☐ | Multi-select |

Click test name → navigates to `/launches/{launchId}/items/{itemId}/log`
(TestDetail with logs tab open).

---

## 5. Test Detail (terminal node)

This is where the investigation actually happens. URL:
`/launches/:launchId/items/:itemId/log`.

### 5.1 Page Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⇕  All › Demo API Tests #18 › Suite with retries › First test case ›        │
│                                                       first test             │
│      ☐ History Across All Launches      ◀  ▶              ⟳ Refresh         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ▌#7▐ ▌#8▐ ▌#9▐ ▌#10▐ ▌#11▐ ▌#12▐ ▌#13▐ ▌#14▐ ▌#15▐ ▌#16▐ ▌#17▐ ▌#18▐      │
│    SI   AB   PB   ✓     SI   SI   SI   AB   SI   PB   AB   PB                │
│   ←──── retry chain across launches (HISTORY toggle on) ──────→             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  💬 Comment                              Save the comment                    │
│                                          ▾ More  🐞 0   FAILED ▾  ●Product   │
│                                                                  Bug         │
│                                                          [ Make decision ]   │
│                                                                              │
│  🔁 Retries     1   2   3   4                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  📋 STACK TRACE   📜 ALL LOGS   📎 ATTACHMENTS   ℹ ITEM DETAILS   🕒 HIST.   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Fatal  Error  Warn  Info  Debug  Trace  All        ◀  ▶  2 Error Logs       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                │
│                                                                              │
│  ☐ Logs with Attachment       [M↓] [⚡]  [⚙]                  1 of 1 ◀ ▶    │
│                                                                              │
│  LOG MESSAGE                                                          TIME ⌃ │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ▌ 11:59:05.791 [TestNG-tests-1] ERROR …FailureLoggingListener -       │   │
│  │   Test createExternalSystemUnableInteractWithExternalSystem failed…   │   │
│  │   …                                                                   │   │
│  │   Status code: 404                                                    │   │
│  │   …                            2026-05-06 08:59:35                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Header Strip

| Element | Behavior |
|---|---|
| Breadcrumb | Full path back to `All` |
| **History Across All Launches** | Toggle. When on, shows previous attempts of THIS test on other launches (the colored pills below) |
| ◀ ▶ | Navigate to previous/next failed test in same launch |
| **Refresh** | Re-fetch logs |

### 5.3 Retry Chain Visualization

A horizontal strip of small status pills, one per attempt. Each pill:
- Shows attempt number (`#7`, `#8`, etc.) — from the parent launch's number
- Background colored to defect type (PB=red, AB=yellow, SI=blue, ND=slate, TI=teal)
- Filled green ✓ for passing attempts
- Highlighted (border + scale) for the currently selected attempt
- Click to switch view to that attempt

When **History Across All Launches** is OFF: shows retries within current launch.
When ON: shows the test across all past launches (broader context).

### 5.4 Comment / Decision Bar

```
💬 Comment                                              ▾ More    Make decision
                                              🐞 0   FAILED ▾  ●Product Bug
🔁 Retries:  1  2  3  4
```

| Element | Behavior |
|---|---|
| Comment field | Free text. "Save the comment" button persists via `POST /comments/` |
| 🐞 N | Linked defects count. Click to expand defect list |
| FAILED ▾ | Manual status override (FAILED → PASSED, etc.) |
| ●Product Bug | Current defect type chip. Color matches token |
| **Make decision** | Opens defect-selection modal (§5.7) |
| Retries 1 2 3 4 | Per-retry log views (separate from the launch-level retry chain above) |

### 5.5 Tab Strip

Five tabs, distinct from the LaunchDetail tabs above:

| Tab | Content | Notes |
|---|---|---|
| **STACK TRACE** | Error message + full stack trace | Side-by-side with first screenshot via `.stack-with-screenshot` (May 2026 commit `88df46c`) |
| **ALL LOGS** | Full log stream, filterable | Default tab when arriving via URL `/log` |
| **ATTACHMENTS** | Screenshots, video, log files, other files | Grid of thumbnails with click-to-zoom |
| **ITEM DETAILS** | Metadata: duration, start/end time, parameters, tags, attributes | Read-only |
| **HISTORY OF ACTIONS** | Audit trail: comments added, defect changed, status overridden, retries, AI analyses | Reverse-chronological list |

### 5.6 Log Viewer (ALL LOGS tab)

#### Filter Toolbar

```
Fatal  Error  Warn  Info  Debug  Trace  All
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Click a level to filter. The bar fills to indicate the cumulative filter
(clicking "Warn" includes Warn + Error + Fatal). "All" resets.

| Tool | Behavior |
|---|---|
| **N Error Logs** | Counter, filtered |
| ☐ **Logs with Attachment** | When checked, only shows log entries that have an attachment |
| **M↓** | Markdown rendering toggle (logs may include markdown) |
| **⚡** | Live tail (auto-scroll on new logs while launch is in-progress) |
| **⚙** | Column settings — show/hide TIME, ATTACHMENT, LEVEL columns |
| ◀ N of M ▶ | Page navigation when log volume is large |
| Search box | Substring search across log messages |

#### Log Row

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▌ 11:59:05.791 [TestNG-tests-1] ERROR c.e.t.r.q.w.c.FailureLoggingListener  │
│   - Test createExternalSystemUnableInteractWithExternalSystem has been      │
│   failed with exception org.testng.TestException:                           │
│   Incorrect Error Type. Expected: UNABLE_INTERACT_WITH_EXTERNAL_SYSTEM…     │
│   Incorrect status code. Expected '409, but was '404'                       │
│       at com.epam.ta.reportportal.qa.ws.core.ExpectedExceptionListener…     │
│       at org.testng.internal.invokers.InvokedMethodListenerInvoker…         │
│                                                              2026-05-06 …  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Left edge: 3px color stripe matching log level
  - Fatal → `--color-fatal` (dark red)
  - Error → `--color-error` (red)
  - Warn → `--color-warn` (orange)
  - Info → `--color-info` (default text color, no stripe)
  - Debug → `--color-debug` (slate)
  - Trace → `--color-trace` (light gray)
- Monospace font (`--font-mono`)
- Long messages truncate with "show more" toggle
- Attachments inline as thumbnails (click to expand)
- Right column: timestamp, sortable

### 5.7 Defect Selection Modal ("Make decision")

Full-screen modal with a left rail and right content area.

#### Left Rail — "Execution to change"

Lists the test (or tests, if "Apply for: All linked items" is chosen):

```
first test                                          ●Product Bug
─────────────────────────────────────────────────────────────
11:59:05.791 [TestNG-tests-1] ERROR …FailureLoggingListener
- Test createExternalSystemUnableInteractWithExternalSystem
has been failed with exception…
─────────────────────────────────────────────────────────────
11:59:04.674 [TestNG-tests-2] ERROR …FailureLoggingListener
- Configuration clearCreatedObjects has been failed…

Apply for:  Current item only ▾
```

`Apply for ▾` options:
- **Current item only** (default)
- **All linked items** (apply to every item in the same retry/sibling group)

#### Right Pane — Three Tabs

```
┌──────────────────────────────────────────────────────────────────────┐
│  Manual              64% Analyzer Suggestion        History of test  │
│  selection                                          ────────────     │
└──────────────────────────────────────────────────────────────────────┘
```

##### Tab 1: Manual selection

```
Select defect manually                       ☐ Ignore in Auto Analysis

┌──────────────┬──────────────┬────────────┬─────────────┬──────────────┐
│ ●Product Bug │ ●Automation  │ ●System    │ ●No Defect  │ ●To Investig.│
│              │  Bug         │  Issue     │             │              │
└──────────────┴──────────────┴────────────┴─────────────┴──────────────┘

Comment ────────────────────────────────────────────────────────────
[H1] [H2] [H3] [¶] [B] [I] [S]    [• list] [1. list] [🖼][🔗] [❝][</>][👁]

[ + Post issue ]   [ + Link issue ]
```

- The 5 defect-type buttons match the abbreviation/color convention (PB/AB/SI/ND/TI)
- Selecting a button highlights it
- Comment editor with markdown toolbar
- "Ignore in Auto Analysis" — if checked, this manual decision will NOT be fed back to the analyzer as training signal
- "Post issue" / "Link issue" — opens BTS integration modal (Jira, ADO, etc.). Currently posts a placeholder URL since BTS integrations are settings-page placeholders only.

##### Tab 2: NN% Analyzer Suggestion

Shown only when `FailureAnalysis` exists for this item.

```
Analyzer Suggestion                                Confidence: 64%

Suggested defect type:  ●Automation Bug

Reasoning:
The error message indicates a 404 status code where 409 was expected,
combined with "PROJECT_NOT_FOUND" instead of the expected
"UNABLE_INTERACT_WITH_EXTERNAL_SYSTEM" error type. This pattern
suggests test data setup issue rather than product logic — likely an
automation bug in test fixtures.

Top 3 similar past failures:
  ▸ #15 → AB (resolved)
  ▸ #11 → AB (resolved)
  ▸ #6  → AB (resolved)

[ Accept suggestion ]    [ Override with manual ▼ ]
```

- Confidence < 0.4 → defaults to "To Investigate" (no Accept button)
- Accepting sends both the chosen defect type AND positive feedback to ML

##### Tab 3: History of the test

Shows defect classifications across past runs of this same test signature.
Helps users see "this test has been an Automation Bug 4 times in a row, probably AB again."

#### Footer

```
                                              [ Cancel ]    [ Apply ]
```

- **Cancel** — close without saving
- **Apply** — `PUT /launches/{id}/items/{item_id}/analyses/{analysis_id}` (manual override) or `POST` for new analysis

#### Toasts on Apply

After clicking Apply, two toasts appear stacked at the bottom:

```
✓ User choice of suggested item was sent for handling to ML       ✕
✓ Defects have been updated                                       ✕
```

The first toast appears only when the user accepted/modified an
analyzer suggestion. The second always appears.

---

## 6. Component Inventory

Pages and key components needed to implement this navigation:

### Pages (`src/pages/`)

- `Login.tsx`
- `Dashboards.tsx` (was `Dashboard.tsx`)
- `DashboardDetail.tsx`
- `LaunchList.tsx`
- `LaunchDetail.tsx`
- `SuiteDetail.tsx`
- `TestDetail.tsx`
- `Members.tsx`
- `Settings.tsx`
- `Profile.tsx`

### Reusable Components (`src/components/`)

- `Layout.tsx` — sidebar shell
- `Sidebar.tsx`
- `Breadcrumb.tsx` — `<Breadcrumb items={[...]} />`
- `StatusStrip.tsx` — the PB/AB/SI/ND/TI badge bar
- `StatusBadge.tsx` — single defect-type badge
- `LaunchRow.tsx` — list row with expandable description
- `RetryChain.tsx` — horizontal pills for the test detail page
- `DecisionBar.tsx` — comment + status + Make decision button
- `LogViewer.tsx` — full log stream with filter toolbar
- `LogFilterBar.tsx` — Fatal/Error/Warn/Info/Debug/Trace/All
- `LogRow.tsx`
- `StackTraceBlock.tsx`
- `ScreenshotViewer.tsx` (with `hideEmpty` prop, May 2026)
- `AttachmentGrid.tsx`
- `AnalysisPanel.tsx`
- `DefectSelector.tsx` — the "Make decision" modal
- `DefectTypeButton.tsx`
- `MarkdownEditor.tsx` — for comments
- `AddFilterModal.tsx`
- `ImportLaunchModal.tsx`

### Hooks

- `useBreadcrumb()` — derives breadcrumb from URL params + fetched item names
- `usePolling(fn, intervalMs, enabled)` — for live launches
- `useStatusCounts(launchId, itemId?)` — fetches the PB/AB/SI/ND/TI tallies

---

## 7. State & Data Fetching

### URL-driven state

Filters, sort, page size, and the "All vs Latest launches" toggle persist
in the URL query string. This makes views shareable and back/forward
navigation work intuitively.

Example URL with filters applied:

```
/launches?scope=all&filter=status:in:FAILED,ERROR&filter=tag:cnt:nightly&sort=start_time:desc&page=2
```

### Polling

- LaunchList — poll `GET /launches` every 15s when there's an in-progress launch visible
- LaunchDetail — poll the same endpoint every 5s while the launch is `IN_PROGRESS`
- TestDetail — poll `GET /items/{id}/logs` every 3s while the parent launch is in-progress and the user is on the ALL LOGS tab with live tail (⚡) enabled

Polling stops when the relevant entity reaches a terminal state.

### Pagination

Default: 50 per page (matches ReportPortal's default). Per-page selector at
bottom right with options: 25, 50, 100, 200.

---

## 8. Empty States

Each major page has an empty state for when there's no data:

- **Launch List** — "No launches yet. Run your test suite with the pytest plugin to get started." + link to plugin docs
- **Dashboards** — "No dashboards yet. Click 'Add New Dashboard' to create one."
- **Launch Detail (no items)** — "This launch has no test items yet."
- **Test Detail (no logs)** — "No logs were recorded for this test."
- **Attachments tab (none)** — Hidden entirely (per `hideEmpty` prop on ScreenshotViewer when embedded)

Use `.empty-state` classes from `components.css`.

---

## 9. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `/` | Focus search/filter input on current page |
| `j` / `k` | Next / previous row in lists |
| `Enter` | Drill into selected row |
| `Esc` | Close modals (DefectSelector, AddFilter, etc.) |
| `r` | Refresh current page data |
| `?` | Show shortcut help overlay |
| `g d` | Go to Dashboards |
| `g l` | Go to Launches |
| `g s` | Go to Settings |

> Status (May 2026): not yet implemented. This is the target spec when
> shortcuts get built.

---

## 10. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `≥ 1280px` | Default layout — sidebar 240px, main content max 1280px |
| `≥ 1100px` | TestDetail stack tab keeps 1fr / 280px side-by-side layout |
| `< 1100px` | TestDetail stack tab collapses to single column |
| `< 900px` | Sidebar collapses to icon-only (40px), can be expanded with hamburger |
| `< 600px` | Tables become card lists (rows render as stacked cards) |

---

## 11. Open Implementation Items

> Update this list as items land. Cross-reference `ROUTER.md` blocker list.

### Pages that need to be split out / renamed

- [ ] `Dashboards.tsx` (currently `Dashboard.tsx`?) — split into list + detail components
- [ ] `SuiteDetail.tsx` — currently rolls up into `LaunchDetail.tsx`; should be its own page for clarity
- [ ] `TestDetail.tsx` — exists today; verify all 5 tabs are present (STACK TRACE, ALL LOGS, ATTACHMENTS, ITEM DETAILS, HISTORY OF ACTIONS)

### Components missing or partial

- [ ] `Breadcrumb.tsx` — verify it accepts a typed array and renders separators
- [ ] `StatusStrip.tsx` — verify it appears on Launch, Suite, and TestCase detail headers
- [ ] `RetryChain.tsx` — verify "History Across All Launches" toggle works
- [ ] `DefectSelector.tsx` Tab 2 (Analyzer Suggestion) — currently shows "AI not configured" since Ollama is disabled on twd00030
- [ ] Keyboard shortcuts — not implemented yet

### Behaviors to verify

- [ ] URL filters persist across reloads (deep linking works)
- [ ] Polling stops when launch finishes
- [ ] Empty states show in all listed locations
- [ ] Toast queue handles multiple stacked toasts (after Apply in DefectSelector)
- [ ] Pagination state persists in URL

---

## 12. Cross-References

- `CLAUDE.md` §6 — overall design system and frontend architecture
- `CLAUDE.md` §6.7 — short-form summary of this navigation flow
- `CLAUDE.md` §11 — pages/components project structure
- `CLAUDE.md` §12 — comparison with ReportPortal
- `docs/reportportal-architecture.md` — upstream system this is modeled on
- ReportPortal demo: [demo.reportportal.io](https://demo.reportportal.io) — live reference
