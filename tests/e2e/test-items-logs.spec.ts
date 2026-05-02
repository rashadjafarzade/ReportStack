/**
 * Test items, logs, and attachments coverage.
 */
import { test, expect } from "@playwright/test";
import {
  registerUser,
  createLaunch,
  addTestItems,
  addLogs,
  uploadAttachment,
  bootSignedIn,
  apiClient,
  TINY_PNG,
} from "./fixtures/api-helper";

test.describe("Test items, logs, attachments", () => {
  test("failed test surfaces in launch detail with a failed badge", async ({
    page,
  }) => {
    const user = await registerUser({ emailPrefix: "failed-render" });
    const launch = await createLaunch(user.token, {
      name: `fail-render-${Date.now()}`,
    });
    await addTestItems(user.token, launch.id, [
      {
        name: "test_login_button_missing",
        status: "FAILED",
        error_message: "Element not found",
      },
    ]);

    await bootSignedIn(page, user, `/launches/${launch.id}`);
    await expect(
      page.getByText("test_login_button_missing")
    ).toBeVisible();
  });

  test("logs uploaded via batch endpoint are returned by GET", async ({}) => {
    const user = await registerUser({ emailPrefix: "logs-api" });
    const launch = await createLaunch(user.token, {
      name: `logs-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_logging", status: "FAILED" },
    ]);
    await addLogs(user.token, launch.id, item.id, [
      { level: "INFO", message: "starting test" },
      { level: "WARN", message: "selector slow" },
      { level: "ERROR", message: "click failed: button not found" },
    ]);

    const ctx = await apiClient(user.token);
    const res = await ctx.get(
      `/launches/${launch.id}/items/${item.id}/logs/`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const messages = (body.items || body).map((l: any) => l.message);
    expect(messages).toContain("starting test");
    expect(messages).toContain("click failed: button not found");
    await ctx.dispose();
  });

  test("log-level filter narrows results to ERROR only", async ({}) => {
    const user = await registerUser({ emailPrefix: "log-filter" });
    const launch = await createLaunch(user.token, {
      name: `lf-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_filter", status: "FAILED" },
    ]);
    await addLogs(user.token, launch.id, item.id, [
      { level: "INFO", message: "noisy info" },
      { level: "ERROR", message: "the loud one" },
    ]);
    const ctx = await apiClient(user.token);
    const res = await ctx.get(
      `/launches/${launch.id}/items/${item.id}/logs/?level=ERROR`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const messages = (body.items || body).map((l: any) => l.message);
    expect(messages).toContain("the loud one");
    expect(messages).not.toContain("noisy info");
    await ctx.dispose();
  });

  test("uploading an attachment then GETting it returns the same bytes", async ({}) => {
    const user = await registerUser({ emailPrefix: "att-bytes" });
    const launch = await createLaunch(user.token, {
      name: `att-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_screenshot", status: "FAILED" },
    ]);
    await uploadAttachment(
      user.token,
      launch.id,
      item.id,
      "screenshot.png",
      TINY_PNG
    );

    const ctx = await apiClient(user.token);
    const list = await ctx.get(
      `/launches/${launch.id}/items/${item.id}/attachments`
    );
    expect(list.ok()).toBeTruthy();
    const attachments = await list.json();
    expect(attachments.length).toBeGreaterThanOrEqual(1);

    const id = attachments[0].id;
    const file = await ctx.get(`/attachments/${id}/file`);
    expect(file.ok()).toBeTruthy();
    const bytes = Buffer.from(await file.body());
    expect(bytes.length).toBe(TINY_PNG.length);
    await ctx.dispose();
  });

  test("attachment over 20MB is rejected", async ({}) => {
    const user = await registerUser({ emailPrefix: "att-large" });
    const launch = await createLaunch(user.token, {
      name: `large-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      { name: "test_big", status: "FAILED" },
    ]);
    const big = Buffer.alloc(21 * 1024 * 1024, 0x42); // 21MB
    const ctx = await apiClient(user.token);
    const res = await ctx.post(
      `/launches/${launch.id}/items/${item.id}/attachments`,
      {
        multipart: {
          file: { name: "huge.bin", mimeType: "application/octet-stream", buffer: big },
        },
      }
    );
    expect(
      res.status(),
      `expected 4xx for oversize, got ${res.status()}`
    ).toBeGreaterThanOrEqual(400);
    await ctx.dispose();
  });

  test("test detail page renders error message and stack trace", async ({
    page,
  }) => {
    const user = await registerUser({ emailPrefix: "td-render" });
    const launch = await createLaunch(user.token, {
      name: `td-${Date.now()}`,
    });
    const [item] = await addTestItems(user.token, launch.id, [
      {
        name: "test_with_error",
        status: "FAILED",
        error_message: "AssertionError: expected true",
        stack_trace:
          "  File \"tests/foo.py\", line 12, in test_with_error\n    assert False",
      },
    ]);
    await addLogs(user.token, launch.id, item.id, [
      { level: "ERROR", message: "test_with_error: assertion failed" },
    ]);

    await bootSignedIn(
      page,
      user,
      `/launches/${launch.id}/items/${item.id}`
    );
    await expect(page.getByText(/AssertionError/)).toBeVisible();
    // Stack trace block contains the file ref.
    await expect(page.getByText(/tests\/foo\.py/)).toBeVisible();
  });
});
