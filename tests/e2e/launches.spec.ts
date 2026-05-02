/**
 * Launch lifecycle + filtering coverage.
 */
import { test, expect } from "@playwright/test";
import {
  registerUser,
  createLaunch,
  finishLaunch,
  addTestItems,
  bootSignedIn,
  apiClient,
} from "./fixtures/api-helper";

test.describe("Launch lifecycle", () => {
  test("seeded launch appears in /launches list", async ({ page }) => {
    const user = await registerUser({ emailPrefix: "launch-list" });
    const launch = await createLaunch(user.token, {
      name: `seeded-list-${Date.now()}`,
    });

    await bootSignedIn(page, user, "/launches");
    await expect(page.getByText(launch.name)).toBeVisible();
  });

  test("clicking a launch opens its detail page", async ({ page }) => {
    const user = await registerUser({ emailPrefix: "launch-click" });
    const launch = await createLaunch(user.token, {
      name: `clickable-${Date.now()}`,
    });
    await addTestItems(user.token, launch.id, [
      { name: "test_smoke", status: "PASSED" },
    ]);

    await bootSignedIn(page, user, "/launches");
    await page.getByRole("link", { name: launch.name }).click();
    await expect(page).toHaveURL(new RegExp(`/launches/${launch.id}`));
    // Tests tab/section should render the seeded item.
    await expect(page.getByText("test_smoke")).toBeVisible();
  });

  test("IN_PROGRESS launch shows a LIVE badge", async ({ page }) => {
    const user = await registerUser({ emailPrefix: "live-badge" });
    const launch = await createLaunch(user.token, {
      name: `live-${Date.now()}`,
    });
    // Don't finish — status stays IN_PROGRESS.

    await bootSignedIn(page, user, `/launches/${launch.id}`);
    await expect(page.getByText("LIVE").first()).toBeVisible();
  });

  test("finished launch transitions out of LIVE", async ({ page }) => {
    const user = await registerUser({ emailPrefix: "finish" });
    const launch = await createLaunch(user.token, {
      name: `to-finish-${Date.now()}`,
    });
    await addTestItems(user.token, launch.id, [
      { name: "test_pass", status: "PASSED" },
    ]);
    await finishLaunch(user.token, launch.id, "PASSED");

    await bootSignedIn(page, user, `/launches/${launch.id}`);
    // "LIVE" badge text should not appear once finished.
    await expect(page.getByText("LIVE")).toHaveCount(0);
  });

  test("API: listing launches respects the status filter", async ({}) => {
    const user = await registerUser({ emailPrefix: "filter-api" });
    const passed = await createLaunch(user.token, {
      name: `passed-${Date.now()}`,
    });
    const failed = await createLaunch(user.token, {
      name: `failed-${Date.now()}`,
    });
    await addTestItems(user.token, passed.id, [
      { name: "p", status: "PASSED" },
    ]);
    await addTestItems(user.token, failed.id, [
      { name: "f", status: "FAILED" },
    ]);
    await finishLaunch(user.token, passed.id, "PASSED");
    await finishLaunch(user.token, failed.id, "FAILED");

    const ctx = await apiClient(user.token);
    const res = await ctx.get("/launches/?status=FAILED");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const names = (body.items || body).map((l: any) => l.name);
    expect(names).toContain(failed.name);
    expect(names).not.toContain(passed.name);
    await ctx.dispose();
  });

  test("retry chain — a retry test references its parent via retry_of", async ({}) => {
    const user = await registerUser({ emailPrefix: "retry" });
    const launch = await createLaunch(user.token, {
      name: `retry-${Date.now()}`,
    });

    const ctx = await apiClient(user.token);
    // First attempt — FAILED.
    const r1 = await ctx.post(`/launches/${launch.id}/items/`, {
      data: {
        name: "test_flaky",
        suite: "tests/flaky.py",
        status: "FAILED",
        duration_ms: 1000,
        error_message: "first attempt failed",
      },
    });
    expect(r1.ok()).toBeTruthy();
    const first = await r1.json();
    // Retry — references the first via retry_of.
    const r2 = await ctx.post(`/launches/${launch.id}/items/`, {
      data: {
        name: "test_flaky",
        suite: "tests/flaky.py",
        status: "PASSED",
        duration_ms: 900,
        retry_of: first.id,
      },
    });
    expect(r2.ok()).toBeTruthy();
    const second = await r2.json();

    // Retries endpoint — should return the chain.
    const chain = await ctx.get(
      `/launches/${launch.id}/items/${first.id}/retries`
    );
    expect(chain.ok()).toBeTruthy();
    const ids = (await chain.json()).map((i: any) => i.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
    await ctx.dispose();
  });

  test("bulk-update sets the same status on many items", async ({}) => {
    const user = await registerUser({ emailPrefix: "bulk" });
    const launch = await createLaunch(user.token, {
      name: `bulk-${Date.now()}`,
    });
    const items = await addTestItems(user.token, launch.id, [
      { name: "test_a", status: "FAILED" },
      { name: "test_b", status: "FAILED" },
    ]);
    const ctx = await apiClient(user.token);
    const res = await ctx.post(`/launches/${launch.id}/items/bulk-update`, {
      data: {
        item_ids: items.map((i) => i.id),
        status: "SKIPPED",
      },
    });
    expect(
      res.ok(),
      `bulk-update: ${res.status()} ${await res.text()}`
    ).toBeTruthy();
    // Refetch and assert.
    const list = await ctx.get(`/launches/${launch.id}/items/`);
    const fetched = (await list.json()).items || (await list.json());
    for (const item of fetched) {
      expect(item.status).toBe("SKIPPED");
    }
    await ctx.dispose();
  });
});
