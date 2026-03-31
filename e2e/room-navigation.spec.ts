import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("room links inside each visible property load without server errors", async ({ page }) => {
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  await page.goto("/properties", { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, "properties index");

  const propertyHrefs = await page.locator('[data-testid="property-link"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
  );

  expect(propertyHrefs.length).toBeGreaterThan(0);

  for (const propertyHref of propertyHrefs) {
    if (!propertyHref) continue;

    monitor.reset();
    await page.goto(propertyHref, { waitUntil: "networkidle" });
    await assertAppHealthy(page, monitor, `property detail ${propertyHref}`);

    const roomHrefs = await page.locator('[data-testid="room-link"]').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
    );

    expect(roomHrefs.length, `expected rooms in ${propertyHref}`).toBeGreaterThan(0);

    for (let index = 0; index < roomHrefs.length; index += 1) {
      const roomHref = roomHrefs[index];
      if (!roomHref) continue;

      monitor.reset();
      await Promise.all([
        page.waitForURL((url) => url.pathname === roomHref),
        page.locator(`[data-testid="room-link"][href="${roomHref}"]`).click(),
      ]);
      await expect(page).toHaveURL(new RegExp(`${roomHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      await assertAppHealthy(page, monitor, `room detail ${roomHref}`);

      if (index === 0) {
        monitor.reset();
        await page.goBack({ waitUntil: "networkidle" });
        await expect(page).toHaveURL(new RegExp(`${propertyHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
        await assertAppHealthy(page, monitor, `back to property ${propertyHref}`);

        monitor.reset();
        await page.goForward({ waitUntil: "networkidle" });
        await expect(page).toHaveURL(new RegExp(`${roomHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
        await assertAppHealthy(page, monitor, `forward to room ${roomHref}`);
      }

      monitor.reset();
      await page.goto(propertyHref, { waitUntil: "networkidle" });
      await assertAppHealthy(page, monitor, `return to property ${propertyHref}`);
    }
  }
});
