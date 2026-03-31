import type { Page } from "@playwright/test";

const BLOCKED_PATH_PATTERNS = [
  /\/api\//,
  /\/login$/,
  /\/.*\/edit(?:\/|$)?/,
  /\/.*\/new(?:\/|$)?/,
  /\?dl=1/,
];

const SAFE_APP_PATH_PATTERNS = [
  /^\/dashboard$/,
  /^\/properties(?:\/[^/]+)?$/,
  /^\/rooms\/[^/]+$/,
  /^\/tenants(?:\/[^/]+)?$/,
  /^\/payments(?:\?.*)?$/,
  /^\/settings$/,
];

function isBlockedPath(path: string) {
  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function isSafePath(path: string) {
  return SAFE_APP_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export async function collectSafeInternalLinks(page: Page) {
  const links = await page.locator("a[href]").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const anchor = node as HTMLAnchorElement;
        const rect = anchor.getBoundingClientRect();
        const url = new URL(anchor.href, window.location.href);
        return {
          href: `${url.pathname}${url.search}`,
          text: (anchor.textContent ?? anchor.getAttribute("title") ?? "").trim(),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((link) => link.visible)
  );

  return Array.from(
    new Map(
      links
        .filter((link) => link.href.startsWith("/"))
        .filter((link) => !isBlockedPath(link.href))
        .filter((link) => isSafePath(link.href))
        .map((link) => [link.href, link])
    ).values()
  );
}
