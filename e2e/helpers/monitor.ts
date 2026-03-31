import { expect, type Page, type Response } from "@playwright/test";
import { E2E_BASE_URL } from "./env";

interface ConsoleEntry {
  text: string;
  type: string;
}

interface NetworkEntry {
  url: string;
  status?: number;
  failure?: string;
  resourceType: string;
}

export interface AppMonitor {
  consoleErrors: ConsoleEntry[];
  pageErrors: string[];
  networkErrors: NetworkEntry[];
  reset: () => void;
}

const APP_ERROR_PATTERNS = [
  "Application error",
  "Something went wrong",
  "Unhandled Runtime Error",
  "An error occurred in the Server Components render",
  "Internal Server Error",
];

function sameOrigin(url: string) {
  return new URL(url).origin === new URL(E2E_BASE_URL).origin;
}

function shouldTrackResponse(response: Response) {
  const resourceType = response.request().resourceType();
  if (!sameOrigin(response.url())) return false;
  if (!["document", "fetch", "xhr"].includes(resourceType)) return false;
  return response.status() >= 500;
}

function shouldTrackRequestFailure(url: string, failureText: string | undefined, resourceType: string) {
  if (!sameOrigin(url)) return false;
  if (failureText === "net::ERR_ABORTED") return false;
  return ["document", "fetch", "xhr"].includes(resourceType);
}

function shouldTrackConsoleError(text: string) {
  if (text.includes("Failed to load resource") && text.includes("404")) {
    return false;
  }

  return true;
}

export function attachAppMonitor(page: Page): AppMonitor {
  const monitor: AppMonitor = {
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    reset: () => {
      monitor.consoleErrors.length = 0;
      monitor.pageErrors.length = 0;
      monitor.networkErrors.length = 0;
    },
  };

  page.on("console", (message) => {
    if (message.type() === "error" && shouldTrackConsoleError(message.text())) {
      monitor.consoleErrors.push({ text: message.text(), type: message.type() });
    }
  });

  page.on("pageerror", (error) => {
    monitor.pageErrors.push(String(error));
  });

  page.on("response", (response) => {
    if (shouldTrackResponse(response)) {
      monitor.networkErrors.push({
        url: response.url(),
        status: response.status(),
        resourceType: response.request().resourceType(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    const failureText = request.failure()?.errorText;
    if (shouldTrackRequestFailure(request.url(), failureText, request.resourceType())) {
      monitor.networkErrors.push({
        url: request.url(),
        failure: failureText,
        resourceType: request.resourceType(),
      });
    }
  });

  return monitor;
}

export async function assertAppHealthy(page: Page, monitor: AppMonitor, context: string) {
  const bodyText = (await page.textContent("body")) ?? "";

  for (const pattern of APP_ERROR_PATTERNS) {
    expect(bodyText, `${context}: unexpected app error text "${pattern}"`).not.toContain(pattern);
  }

  expect(monitor.pageErrors, `${context}: unexpected page errors`).toEqual([]);
  expect(monitor.consoleErrors, `${context}: unexpected console errors`).toEqual([]);
  expect(monitor.networkErrors, `${context}: unexpected failed requests`).toEqual([]);
}
