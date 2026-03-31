import { expect, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from "./env";

export async function login(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', E2E_TEST_EMAIL);
  await page.fill('input[name="password"]', E2E_TEST_PASSWORD);
  await Promise.all([
    page.waitForURL("**/dashboard"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
