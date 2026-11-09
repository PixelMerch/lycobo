import { afterEach, expect, it } from "vitest";
import { useLocaleStore } from "../i18n/locale-store";
import { serverErrorMessage } from "./server-error";

const failure = (code: string) => ({
  message: "企业积分余额不足，优化提示词需要 1 积分",
  error: { code },
});

afterEach(() => useLocaleStore.setState({ locale: "zh-CN" }));

it("shows the server's own Chinese text in the Chinese interface", () => {
  useLocaleStore.setState({ locale: "zh-CN" });
  expect(serverErrorMessage(failure("INSUFFICIENT_CREDITS"))).toBe(
    "企业积分余额不足，优化提示词需要 1 积分",
  );
});

it("replaces server text by error code in the English interface", () => {
  useLocaleStore.setState({ locale: "en" });
  expect(serverErrorMessage(failure("INSUFFICIENT_CREDITS"))).toBe("Not enough team credits.");
  expect(serverErrorMessage(failure("INVALID_CREDENTIALS"))).toBe(
    "The account or password is incorrect.",
  );
});

it("falls back to a general English message for unknown codes", () => {
  useLocaleStore.setState({ locale: "en" });
  expect(serverErrorMessage(failure("SOMETHING_NEW"))).toBe(
    "The service is unavailable right now. Please try again later.",
  );
});
