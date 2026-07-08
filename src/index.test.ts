/**
 * vlist-vue — real render tests
 *
 * Mounts a Vue component that uses the `useVList` composable into happy-dom via
 * `createApp`, lets `onMounted` create a real vlist instance, and asserts it
 * virtualizes and tears down cleanly. Includes floor/vlist#119 coverage: a
 * `plugins` array overlapping the composable's auto-wiring must run without a
 * "Duplicate plugin" throw.
 */

// happy-dom is registered via the ./happydom.ts preload (see bunfig.toml) so
// that vue's runtime-dom captures a live `document` at import time.
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createApp, h, nextTick, type ShallowRef } from "vue";
import { useVList } from "./index";
import { grid, autosize, type VListItem, type VList } from "vlist";

interface Row extends VListItem {
  id: string;
}

const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));
const template = (r: Row): string => `<div class="row" data-id="${r.id}">${r.id}</div>`;

const VIEWPORT_H = 500;
const VIEWPORT_W = 300;

function installLayoutShims(): () => void {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => VIEWPORT_H });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => VIEWPORT_W });
  const RealRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.cb = cb; }
    observe(target: Element): void {
      this.cb([{ target, contentRect: { width: VIEWPORT_W, height: VIEWPORT_H } as DOMRectReadOnly } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  const realRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  return () => { globalThis.ResizeObserver = RealRO; globalThis.requestAnimationFrame = realRAF; };
}

let restoreShims: () => void;
beforeAll(() => { restoreShims = installLayoutShims(); });
afterAll(() => { restoreShims?.(); });

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

/** Mount a component whose setup() calls useVList; returns the host + app. */
async function mount(config: Parameters<typeof useVList<Row>>[0]) {
  const captured: { instance?: ShallowRef<VList<Row> | null> } = {};
  const App = {
    setup() {
      const { containerRef, instance } = useVList<Row>(config);
      captured.instance = instance;
      return () => h("div", { ref: containerRef, style: { height: `${VIEWPORT_H}px` } });
    },
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(App);
  app.mount(host);
  await nextTick();
  await flush();
  return { host, app, captured };
}

describe("useVList — render", () => {
  it("mounts and virtualizes a large list", async () => {
    const { host, app, captured } = await mount({ item: { height: 40, template }, items: rows(1000) });
    expect(captured.instance?.value).not.toBeNull();
    const rendered = host.querySelectorAll(".row");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(100);
    app.unmount();
  });

  it("tears down the instance on unmount", async () => {
    const { app, captured } = await mount({ item: { height: 40, template }, items: rows(100) });
    expect(captured.instance?.value).not.toBeNull();
    app.unmount();
    expect(captured.instance?.value).toBeNull();
  });

  it("#119: accepts and runs a plugins array overlapping auto-wiring", async () => {
    const { host, app, captured } = await mount({
      item: { estimatedHeight: 200, template },
      items: rows(200),
      plugins: [grid({ columns: 3 }), autosize()],
    });
    expect(captured.instance?.value).not.toBeNull();
    expect(host.querySelectorAll(".row").length).toBeGreaterThan(0);
    app.unmount();
  });
});
