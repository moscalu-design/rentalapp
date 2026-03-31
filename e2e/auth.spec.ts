import { test } from "@playwright/test";
import { login } from "./helpers/auth";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("login loads the dashboard successfully", async ({ page }) => {
  const monitor = attachAppMonitor(page);

  await login(page);
  await assertAppHealthy(page, monitor, "dashboard after login");
});
