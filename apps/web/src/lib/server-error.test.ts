import { afterEach, expect, it } from "vitest";
import { useLocaleStore } from "../i18n/locale-store";
import { serverErrorMessage } from "./server-error";

const failure = (code: string, message = "请检查输入内容") => ({
  message,
  error: { code },
});

afterEach(() => useLocaleStore.setState({ locale: "zh-CN" }));

it("shows the server's own Chinese text in the Chinese interface", () => {
  useLocaleStore.setState({ locale: "zh-CN" });
  expect(serverErrorMessage(failure("VALIDATION_ERROR"))).toBe("请检查输入内容");
});

it("uses one concise credits message even if an older server says enterprise coins", () => {
  const error = failure("INSUFFICIENT_CREDITS", "企业金币余额不足，每张图片需要 2 币");
  useLocaleStore.setState({ locale: "zh-CN" });
  expect(serverErrorMessage(error)).toBe("积分不足，请充值后重试");
  useLocaleStore.setState({ locale: "en" });
  expect(serverErrorMessage(error)).toBe("Not enough credits. Top up to try again.");
});

it("replaces server text by error code in the English interface", () => {
  useLocaleStore.setState({ locale: "en" });
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
