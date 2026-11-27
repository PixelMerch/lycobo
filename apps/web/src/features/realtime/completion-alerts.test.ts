import type { ImageJob } from "@lycoboai/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocaleStore } from "../../i18n/locale-store";
import { completedResult, createCompletionAlerts } from "./completion-alerts";
import { observeCompletedJobs } from "./completion-observer";
import { setDesktopNotifications } from "./desktop-notifications";

const userId = crypto.randomUUID();
const organizationId = crypto.randomUUID();
const scope = `${organizationId}:${userId}`;
const doc = Object.assign(new EventTarget(), {
  title: "Lycobo · 电商创作工作台",
  visibilityState: "visible",
  querySelector: vi.fn(() => null),
  getElementById: vi.fn(),
});
let stored = new Map<string, string>();
beforeEach(() => {
  // 断言按中文标题编写，固定界面语言。
  useLocaleStore.setState({ locale: "zh-CN" });
  stored = new Map();
  doc.title = "Lycobo · 电商创作工作台";
  doc.visibilityState = "visible";
  doc.getElementById.mockReset();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { focus: vi.fn() }));
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
function job(): ImageJob {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    organization_id: organizationId,
    model: "gpt-image-2",
    prompt: "fixture",
    resolution: "1K",
    aspect_ratio: "1:1",
    status: "succeeded",
    created_at: new Date().toISOString(),
    completed_at: new Date(Date.now() + 1000).toISOString(),
    requested_count: 1,
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: null,
      },
    ],
  };
}
function controller() {
  const notify = vi.fn(),
    open = vi.fn();
  return {
    alerts: createCompletionAlerts({ userId, organizationId, scope, notify, open }),
    notify,
    open,
  };
}
it("links MCP single-image completions directly to the image set history", () => {
  const result = job();
  expect(completedResult({ ...result, submission_source: "mcp" }).path).toBe(
    `/dashboard/commerce/smart-variation?task=${result.id}`,
  );
});
it("counts background completions once, summarizes on return and only opens on explicit action", async () => {
  doc.visibilityState = "hidden";
  const { alerts, notify, open } = controller();
  const first = job(),
    second = job();
  await alerts.receive(first);
  await alerts.receive(first);
  await alerts.receive(second);
  expect(doc.title).toBe("（2）生成完成 · Lycobo");
  expect(notify).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  expect(notify.mock.calls[0]?.[0]).toHaveLength(2);
  expect(doc.title).toBe("Lycobo · 电商创作工作台");
  notify.mock.calls[0]?.[1]();
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({ path: `/dashboard/commerce/create?task=${second.id}` }),
  );
  await alerts.receive(first);
  expect(notify).toHaveBeenCalledTimes(1);
  alerts.stop();
});
it("retains deduplication across remounts and other tabs", async () => {
  const a = controller(),
    b = controller();
  const result = job();
  await Promise.all([a.alerts.receive(result), b.alerts.receive(result)]);
  expect(a.notify.mock.calls.length + b.notify.mock.calls.length).toBe(1);
  a.alerts.stop();
  b.alerts.stop();
  const c = controller();
  await c.alerts.receive(result);
  expect(c.notify).not.toHaveBeenCalled();
  c.alerts.stop();
});
it("ignores historical, foreign, failed and incomplete tasks", async () => {
  const { alerts, notify } = controller();
  const result = job();
  await alerts.receive({ ...result, completed_at: "2026-01-01T00:00:00Z" });
  await alerts.receive({ ...job(), user_id: crypto.randomUUID() });
  await alerts.receive({ ...job(), organization_id: crypto.randomUUID() });
  await alerts.receive({ ...job(), status: "failed" });
  await alerts.receive({ ...job(), items: [] });
  expect(notify).not.toHaveBeenCalled();
  alerts.stop();
});
it("recognizes an observed running task despite completion clock skew", async () => {
  const { alerts, notify } = controller();
  const result = { ...job(), completed_at: "2026-01-01T00:00:00Z" };
  await alerts.receive(result, { ...result, status: "running" });
  expect(notify).toHaveBeenCalledTimes(1);
  alerts.stop();
});
it("does not interrupt a task already visible in the viewport", async () => {
  doc.getElementById.mockReturnValue({
    getBoundingClientRect: () => ({ width: 400, height: 300, top: 100, bottom: 400 }),
  });
  const { alerts, notify } = controller();
  await alerts.receive(job());
  expect(notify).not.toHaveBeenCalled();
  alerts.stop();
});
it("desktop notifications require permission and explicit preference, and close on cleanup", async () => {
  const close = vi.fn(),
    notices = vi.fn();
  class DesktopNotice {
    static permission = "granted";
    close = close;
    onclick = null;
    constructor(...args: unknown[]) {
      notices(...args);
    }
  }
  vi.stubGlobal("Notification", DesktopNotice);
  doc.visibilityState = "hidden";
  const { alerts } = controller();
  await alerts.receive(job());
  expect(notices).not.toHaveBeenCalled();
  setDesktopNotifications(scope, true);
  await alerts.receive(job());
  expect(notices).toHaveBeenCalledTimes(1);
  alerts.stop();
  expect(close).toHaveBeenCalledTimes(1);
  expect(doc.title).toBe("Lycobo · 电商创作工作台");
});
it("cache observer catches resync history changes without fetching and ignores other resources", () => {
  const client = new QueryClient();
  const result = job();
  client.setQueryData(["image-tasks"], { pages: [{ data: [{ ...result, status: "running" }] }] });
  const receive = vi.fn();
  const stop = observeCompletedJobs(client, receive);
  client.setQueryData(["wallet"], { balance: 2 });
  expect(receive).not.toHaveBeenCalled();
  client.setQueryData(["image-tasks"], { pages: [{ data: [result] }] });
  expect(receive).toHaveBeenCalledWith(result, expect.objectContaining({ status: "running" }));
  stop();
  client.clear();
});
