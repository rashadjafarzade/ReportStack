/**
 * Backend API helpers used by Playwright tests to seed state.
 *
 * Why a helper? The ReportStack UI doesn't expose forms for creating launches
 * or test items — those come from the pytest plugin in production. Tests use
 * the REST API to seed data, then drive the UI for assertions.
 */
import { APIRequestContext, expect, request } from "@playwright/test";

export const API_BASE =
  process.env.RS_API_URL || "http://localhost:8000/api/v1";

export interface UserHandle {
  email: string;
  password: string;
  name: string;
  token: string;
  role: string;
  id: number;
}

export interface LaunchHandle {
  id: number;
  name: string;
  status: string;
  tags?: string[];
}

export interface TestItemHandle {
  id: number;
  name: string;
  suite: string;
  status: string;
}

/** Build an authenticated APIRequestContext that targets the backend. */
export async function apiClient(token?: string): Promise<APIRequestContext> {
  return await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const RAND = () => Math.random().toString(36).slice(2, 8);

/** Register a user via /auth/register and return their token. */
export async function registerUser(opts?: {
  emailPrefix?: string;
  name?: string;
  password?: string;
}): Promise<UserHandle> {
  const email = `${opts?.emailPrefix || "user"}.${RAND()}@e2e.test`;
  const password = opts?.password || "Test1234!";
  const name = opts?.name || "E2E User";
  const ctx = await apiClient();
  const res = await ctx.post("/auth/register", {
    data: { email, name, password },
  });
  expect(res.ok(), `register ${email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return {
    email,
    password,
    name,
    token: body.access_token,
    role: body.user.role,
    id: body.user.id,
  };
}

/** Login an existing user. */
export async function loginUser(email: string, password: string) {
  const ctx = await apiClient();
  const res = await ctx.post("/auth/login", { data: { email, password } });
  expect(res.ok(), `login ${email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body as { access_token: string; user: any };
}

/** Create a launch and return its handle. */
export async function createLaunch(
  token: string,
  opts?: { name?: string; description?: string; tags?: string[] }
): Promise<LaunchHandle> {
  const ctx = await apiClient(token);
  const name = opts?.name || `e2e launch ${RAND()}`;
  const res = await ctx.post("/launches/", {
    data: {
      name,
      description: opts?.description || "seeded by playwright e2e",
      tags: opts?.tags || ["e2e"],
    },
  });
  expect(res.ok(), `create launch: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return { id: body.id, name: body.name, status: body.status, tags: body.tags };
}

/** Finish a launch with a final status. */
export async function finishLaunch(
  token: string,
  launchId: number,
  status: "PASSED" | "FAILED" | "STOPPED" = "FAILED"
) {
  const ctx = await apiClient(token);
  const res = await ctx.put(`/launches/${launchId}/finish`, {
    data: { status },
  });
  expect(res.ok(), `finish launch: ${res.status()}`).toBeTruthy();
  await ctx.dispose();
}

/** Add a batch of test items to a launch. */
export async function addTestItems(
  token: string,
  launchId: number,
  items: Array<{
    name: string;
    suite?: string;
    status: "PASSED" | "FAILED" | "SKIPPED" | "ERROR";
    duration_ms?: number;
    error_message?: string;
    stack_trace?: string;
  }>
): Promise<TestItemHandle[]> {
  const ctx = await apiClient(token);
  const res = await ctx.post(`/launches/${launchId}/items/batch`, {
    data: {
      items: items.map((i) => ({
        suite: i.suite || "tests/sample.py",
        duration_ms: i.duration_ms || 1234,
        ...i,
      })),
    },
  });
  expect(res.ok(), `batch items: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body.map((it: any) => ({
    id: it.id,
    name: it.name,
    suite: it.suite,
    status: it.status,
  }));
}

/** Append a batch of logs to a test item. */
export async function addLogs(
  token: string,
  launchId: number,
  itemId: number,
  logs: Array<{
    level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
    message: string;
  }>
) {
  const ctx = await apiClient(token);
  const res = await ctx.post(
    `/launches/${launchId}/items/${itemId}/logs/batch`,
    {
      data: {
        logs: logs.map((l, i) => ({
          ...l,
          timestamp: new Date(Date.now() + i).toISOString(),
        })),
      },
    }
  );
  expect(res.ok(), `batch logs: ${res.status()}`).toBeTruthy();
  await ctx.dispose();
}

/** Upload an attachment to a test item from raw bytes. */
export async function uploadAttachment(
  token: string,
  launchId: number,
  itemId: number,
  filename: string,
  contents: Buffer,
  mimeType = "image/png"
) {
  const ctx = await apiClient(token);
  const res = await ctx.post(
    `/launches/${launchId}/items/${itemId}/attachments`,
    {
      multipart: {
        file: { name: filename, mimeType, buffer: contents },
      },
    }
  );
  expect(
    res.ok(),
    `upload attachment: ${res.status()} ${await res.text()}`
  ).toBeTruthy();
  await ctx.dispose();
}

/** Add a comment to a test item. */
export async function addItemComment(
  token: string,
  launchId: number,
  itemId: number,
  text: string
) {
  const ctx = await apiClient(token);
  const res = await ctx.post(
    `/launches/${launchId}/items/${itemId}/comments`,
    { data: { text } }
  );
  expect(res.ok(), `comment: ${res.status()}`).toBeTruthy();
  await ctx.dispose();
}

/** Add a defect to a test item. */
export async function addDefect(
  token: string,
  launchId: number,
  itemId: number,
  summary: string,
  status: "OPEN" | "IN_PROGRESS" | "FIXED" | "WONT_FIX" | "DUPLICATE" = "OPEN"
) {
  const ctx = await apiClient(token);
  const res = await ctx.post(
    `/launches/${launchId}/items/${itemId}/defects`,
    { data: { summary, status, defect_type: "PRODUCT_BUG" } }
  );
  expect(res.ok(), `defect: ${res.status()}`).toBeTruthy();
  await ctx.dispose();
}

/** Tiny 1×1 transparent PNG used as a stand-in screenshot. */
export const TINY_PNG: Buffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
  "base64"
);

/** Inject auth into the browser via localStorage so the SPA boots logged-in. */
export async function bootSignedIn(
  page: import("@playwright/test").Page,
  user: UserHandle,
  startPath = "/"
) {
  // Visit a same-origin page first so localStorage is for the right origin.
  await page.goto(startPath);
  await page.evaluate(
    ([token, userJson]) => {
      window.localStorage.setItem("rs_token", token);
      window.localStorage.setItem("rs_user", userJson);
    },
    [user.token, JSON.stringify({
      id: user.id, email: user.email, name: user.name, role: user.role,
    })] as const
  );
  await page.reload();
}
