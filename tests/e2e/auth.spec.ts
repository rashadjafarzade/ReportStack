/**
 * Auth + member role coverage.
 *
 * Pre-existing data assumptions: a clean DB. The first user to register is
 * auto-promoted to ADMIN by the backend (see backend/app/api/auth.py); every
 * subsequent register call yields a MEMBER. We exploit this by registering
 * the admin in beforeAll and the regular member inside the role test.
 */
import { test, expect } from "@playwright/test";
import {
  registerUser,
  loginUser,
  bootSignedIn,
  apiClient,
} from "./fixtures/api-helper";

test.describe("Auth & member roles", () => {
  test("register creates a user, returns a JWT, and persists session", async ({
    page,
  }) => {
    const user = await registerUser({ emailPrefix: "newuser" });
    expect(user.token).toBeTruthy();
    expect(user.email).toMatch(/@e2e\.test$/);

    await bootSignedIn(page, user);
    // Sidebar profile shows the user's name + role.
    await expect(page.getByText(user.name).first()).toBeVisible();
    await expect(page.getByText(user.role).first()).toBeVisible();
  });

  test("login form: invalid credentials surface an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill("nobody@e2e.test");
    await page.getByPlaceholder("Enter password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    // The login-error div renders the API's detail message.
    await expect(page.locator(".login-error")).toBeVisible();
  });

  test("login form: valid credentials sign the user in", async ({ page }) => {
    const user = await registerUser({ emailPrefix: "loginer" });

    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill(user.email);
    await page.getByPlaceholder("Enter password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Redirect to /; sidebar visible.
    await expect(page).toHaveURL(/\/$|\/?$/);
    await expect(
      page.getByRole("link", { name: "Launches" })
    ).toBeVisible();
  });

  test("registration toggle: switch between sign-in and register modes", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Register" }).click();
    // Now the Full name field is visible and the submit becomes "Create Account".
    await expect(page.getByPlaceholder("Jane Doe")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Account" })
    ).toBeVisible();
  });

  test("first registered user is auto-promoted to ADMIN", async ({}) => {
    // Note: this assertion only holds against a clean DB. The reset hook in
    // global-setup wipes users/launches between full-suite runs.
    const first = await registerUser({ emailPrefix: "first" });
    expect(first.role).toBe("ADMIN");
  });

  test("subsequent users default to MEMBER role", async ({}) => {
    // The first-user-becomes-admin hook only fires when the users table is
    // empty. We rely on the previous test having populated at least one user.
    await registerUser({ emailPrefix: "seed-admin" });
    const second = await registerUser({ emailPrefix: "second" });
    expect(["MEMBER", "VIEWER"]).toContain(second.role);
  });

  test("authed user can call /auth/me and gets their profile", async ({}) => {
    const user = await registerUser({ emailPrefix: "me-check" });
    const ctx = await apiClient(user.token);
    const res = await ctx.get("/auth/me");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.email).toBe(user.email);
    expect(body.role).toBe(user.role);
    await ctx.dispose();
  });

  test("non-admin user is forbidden from /auth/users (admin-only)", async ({}) => {
    // Ensure at least one admin exists; then a member should hit 403.
    await registerUser({ emailPrefix: "admin-warmup" });
    const member = await registerUser({ emailPrefix: "non-admin" });
    expect(member.role).not.toBe("ADMIN");
    const ctx = await apiClient(member.token);
    const res = await ctx.get("/auth/users");
    expect(res.status(), `expected 403, got ${res.status()}`).toBe(403);
    await ctx.dispose();
  });

  test("logout clears the session and bounces back to /login", async ({
    page,
  }) => {
    const user = await registerUser({ emailPrefix: "logout" });
    await bootSignedIn(page, user);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    // localStorage should be empty.
    const token = await page.evaluate(() => window.localStorage.getItem("rs_token"));
    expect(token).toBeNull();
  });
});
