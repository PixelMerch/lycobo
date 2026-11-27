import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AccountImageAutomation } from "./account-image-automation";

afterEach(() => vi.unstubAllGlobals());

const language = vi.hoisted(() => ({ locale: "en" }));
vi.mock("../../../i18n/locale-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../i18n/locale-store")>()),
  useLocale: () => language.locale,
}));

it.each([
  { locale: "zh-CN", label: "配置连接", filename: "lycobo-image.zip" },
  { locale: "en", label: "Set up connection", filename: "lycobo-image-en.zip" },
])("shows connection settings and downloads the $locale skill", ({ locale, label, filename }) => {
  language.locale = locale;
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

  expect(html).toContain(label);
  expect(html).toContain(`href="/integrations/${filename}"`);
  expect(html).toContain(`download="${filename}"`);
  expect(html).not.toMatch(/doubao(?:app)?:\/\//);
});
