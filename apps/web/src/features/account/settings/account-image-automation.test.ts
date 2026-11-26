import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AccountImageAutomation } from "./account-image-automation";

afterEach(() => vi.unstubAllGlobals());

it("renders the Doubao desktop launch link in the current tab", () => {
  vi.stubGlobal("window", { location: { origin: "http://localhost" } });
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(AccountImageAutomation, {
        account: {
          userId: "00000000-0000-4000-8000-000000000001",
          organizationId: "00000000-0000-4000-8000-000000000002",
          role: "member",
          account: "fixture",
        },
      }),
    ),
  );

  const launchLink = html.match(/<a\b[^>]*\bhref="doubaoapp:\/\/active-chat"[^>]*>/)?.[0];
  expect(launchLink).toBeDefined();
  expect(launchLink).not.toMatch(/\btarget=/);
});
