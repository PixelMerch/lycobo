import { expect, it } from "vitest";
import { historyLocaleNavigation } from "./history-locale-navigation";

it("仅换语言不重新定位，换任务和主动再次打开仍定位", () => {
  const before = {
    key: "first",
    pathname: "/zh-CN/commerce/create",
    search: "?task=one",
    hash: "",
  };
  const after = { ...before, key: "second", pathname: "/en/commerce/create" };
  expect(historyLocaleNavigation(before, after).key).toBe("first");
  expect(historyLocaleNavigation(before, { ...after, search: "?task=two" }).key).toBe("second");
  expect(historyLocaleNavigation(before, { ...before, key: "third" }).key).toBe("third");
});
