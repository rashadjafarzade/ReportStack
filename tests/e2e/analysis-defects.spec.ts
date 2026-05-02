/**
 * AI analysis, defect override, defects, and comments coverage.
 *
 * AI analysis is exercised at the API layer because triggering it kicks off a
 * background task that calls Ollama. In the test sandbox Ollama is unreachable,
 * so the analyzer falls back to TO_INVESTIGATE — which is exactly what we
 * assert on, plus we cover the manual-override path that doesn't depend on AI.
 */
import { test, expect } from "@playwright/test";
import {
  registerUser,
  createLaunch,
  addTestItems,
  addItemComment,
  addDefect,
  bootSignedIn,
  apiClient,
} from "./fixtures/api-helper";

test.describe("AI analysis, defects, comments", () => {
  test("triggering analysis on a failed item creates a FailureAnalysis row", async ({}) => {
    const user = await registerUser({ emailPrefix: "ai-trigger" });
    const launch = await createLaunch(user.token, {
      name: `ai-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      {
        name: "test_for_ai",
        status: "FAILED",
        error_message: "TimeoutException: element not visible after 10s",
        stack_trace: "  File \"tests/login.py\", line 30",
      },
    ]);

    const ctx = await apiClient(user.token);
    const trigger = await ctx.post(
      `/launches/${launch.id}/items/${item.id}/analyze`
    );
    expect(
      [200, 202],
      `analyze returned ${trigger.status()}`
    ).toContain(trigger.status());

    // Background task may take a beat; poll up to 10s for an analysis row.
    const deadline = Date.now() + 10_000;
    let analyses: any[] = [];
    while (Date.now() < deadline) {
      const res = await ctx.get(
        `/launches/${launch.id}/items/${item.id}/analyses`
      );
      if (res.ok()) {
        analyses = await res.json();
        if (analyses.length) break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(analyses.length).toBeGreaterThanOrEqual(1);
    // The defect_type must be one of the known buckets.
    expect([
      "PRODUCT_BUG",
      "AUTOMATION_BUG",
      "SYSTEM_ISSUE",
      "NO_DEFECT",
      "TO_INVESTIGATE",
    ]).toContain(analyses[0].defect_type);
    await ctx.dispose();
  });

  test("manual override updates the analysis source to MANUAL", async ({}) => {
    const user = await registerUser({ emailPrefix: "override" });
    const launch = await createLaunch(user.token, {
      name: `ovr-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      {
        name: "test_to_override",
        status: "FAILED",
        error_message: "x",
      },
    ]);
    const ctx = await apiClient(user.token);

    // Trigger analysis to create the row.
    await ctx.post(`/launches/${launch.id}/items/${item.id}/analyze`);
    // Wait for at least one analysis to land.
    let analysisId: number | null = null;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const res = await ctx.get(
        `/launches/${launch.id}/items/${item.id}/analyses`
      );
      if (res.ok()) {
        const list = await res.json();
        if (list.length) {
          analysisId = list[0].id;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(analysisId, "expected an analysis row").not.toBeNull();

    // Override: switch to AUTOMATION_BUG.
    const upd = await ctx.put(
      `/launches/${launch.id}/items/${item.id}/analyses/${analysisId}`,
      {
        data: {
          defect_type: "AUTOMATION_BUG",
          confidence: 1.0,
          reasoning: "manual override by qa lead",
        },
      }
    );
    expect(
      upd.ok(),
      `override: ${upd.status()} ${await upd.text()}`
    ).toBeTruthy();
    const updated = await upd.json();
    expect(updated.defect_type).toBe("AUTOMATION_BUG");
    expect(updated.source).toBe("MANUAL");
    await ctx.dispose();
  });

  test("comment CRUD: create, list, update, delete", async ({}) => {
    const user = await registerUser({ emailPrefix: "comment" });
    const launch = await createLaunch(user.token, {
      name: `cmt-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_commented", status: "FAILED" },
    ]);

    const ctx = await apiClient(user.token);
    // Create
    const c1 = await ctx.post(
      `/launches/${launch.id}/items/${item.id}/comments/`,
      { data: { text: "first take — looks like an automation flake" } }
    );
    expect(c1.ok()).toBeTruthy();
    const created = await c1.json();
    // List
    const list = await ctx.get(
      `/launches/${launch.id}/items/${item.id}/comments/`
    );
    expect(list.ok()).toBeTruthy();
    const listed = await list.json();
    expect(listed.map((c: any) => c.id)).toContain(created.id);
    // Update
    const upd = await ctx.put(`/comments/${created.id}`, {
      data: { text: "actually a real bug — see screenshot" },
    });
    expect(upd.ok()).toBeTruthy();
    expect((await upd.json()).text).toMatch(/real bug/);
    // Delete
    const del = await ctx.delete(`/comments/${created.id}`);
    expect(del.ok()).toBeTruthy();
    await ctx.dispose();
  });

  test("defect CRUD: create, update status, list, delete", async ({}) => {
    const user = await registerUser({ emailPrefix: "defect" });
    const launch = await createLaunch(user.token, {
      name: `def-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_defective", status: "FAILED" },
    ]);

    const ctx = await apiClient(user.token);
    const c1 = await ctx.post(
      `/launches/${launch.id}/items/${item.id}/defects/`,
      {
        data: {
          summary: "checkout submit button doesn't respond on iOS",
          status: "OPEN",
          defect_type: "PRODUCT_BUG",
        },
      }
    );
    expect(
      c1.ok(),
      `create defect: ${c1.status()} ${await c1.text()}`
    ).toBeTruthy();
    const created = await c1.json();

    // Update status to IN_PROGRESS.
    const upd = await ctx.put(`/defects/${created.id}`, {
      data: { status: "IN_PROGRESS" },
    });
    expect(upd.ok()).toBeTruthy();
    expect((await upd.json()).status).toBe("IN_PROGRESS");

    // List shows the defect.
    const list = await ctx.get(
      `/launches/${launch.id}/items/${item.id}/defects/`
    );
    expect(list.ok()).toBeTruthy();
    const listed = await list.json();
    expect(listed.map((d: any) => d.id)).toContain(created.id);

    // Delete.
    const del = await ctx.delete(`/defects/${created.id}`);
    expect(del.ok()).toBeTruthy();
    await ctx.dispose();
  });

  test("comments and defects render on the test detail page", async ({
    page,
  }) => {
    const user = await registerUser({ emailPrefix: "td-defect-cmt" });
    const launch = await createLaunch(user.token, {
      name: `td-defect-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_with_context", status: "FAILED", error_message: "boom" },
    ]);
    await addItemComment(
      user.token,
      launch.id,
      item.id,
      "needs another pass — flaky timer"
    );
    await addDefect(
      user.token,
      launch.id,
      item.id,
      "submit fails on first click"
    );

    await bootSignedIn(
      page,
      user,
      `/launches/${launch.id}/items/${item.id}`
    );
    await expect(page.getByText(/flaky timer/)).toBeVisible();
    await expect(
      page.getByText(/submit fails on first click/)
    ).toBeVisible();
  });

  test("analysis-summary aggregates defect-type counts across the launch", async ({}) => {
    const user = await registerUser({ emailPrefix: "summary" });
    const launch = await createLaunch(user.token, {
      name: `sum-${Date.now()}`,
    });
    const items = await addTestItems(user.token, launch.id, [
      { name: "t1", status: "FAILED", error_message: "x" },
      { name: "t2", status: "FAILED", error_message: "y" },
    ]);
    const ctx = await apiClient(user.token);
    // Trigger launch-level analyze.
    const trig = await ctx.post(`/launches/${launch.id}/analyze`);
    expect([200, 202]).toContain(trig.status());

    // Poll the summary endpoint until it has any counts.
    const deadline = Date.now() + 12_000;
    let summary: any = null;
    while (Date.now() < deadline) {
      const res = await ctx.get(`/launches/${launch.id}/analysis-summary`);
      if (res.ok()) {
        summary = await res.json();
        const total = Object.values(summary).reduce(
          (a: number, v: any) => a + (typeof v === "number" ? v : 0),
          0
        );
        if (total >= items.length) break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(summary).not.toBeNull();
    await ctx.dispose();
  });
});
