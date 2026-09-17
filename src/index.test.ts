import { createVList as createSynthetic } from "vlist/synthetic";
import type { VListFactory } from "./index";
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
import { useVList, type UseVListConfig } from "./index";
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
      this.cb([{ target, contentRect: { width: VIEWPORT_W, height: VIEWPORT_H } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: VIEWPORT_W, blockSize: VIEWPORT_H }],
            contentBoxSize: [{ inlineSize: VIEWPORT_W, blockSize: VIEWPORT_H }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
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
async function mount(config: UseVListConfig<Row>) {
  const captured: { instance?: ShallowRef<VList<Row> | null> } = {};
  const App = {
    setup() {
      const { containerRef, instance } = useVList(config);
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
    // estimatedHeight auto-wires autosize(); the user passes autosize() too.
    // The user's replaces the auto-wired one — one plugin, not a duplicate.
    // (grid + autosize, the 2.x form of this test, is a declared conflict in
    // 3.0: grid indexes its size cache by row.)
    const { host, app, captured } = await mount({
      item: { estimatedHeight: 200, template },
      items: rows(200),
      plugins: [autosize()],
    });
    expect(captured.instance?.value).not.toBeNull();
    expect(host.querySelectorAll(".row").length).toBeGreaterThan(0);
    app.unmount();
  });
});

it("forwards a typed synthetic factory and creates the synthetic driver", async () => {
  let calls = 0;
  let pluginNames: string[] = [];
  const factory: VListFactory<Row> = (config, plugins = []) => {
    calls++;
    pluginNames = plugins.map(plugin => plugin.name);
    expect(config).not.toHaveProperty("factory");
    return createSynthetic(config, plugins);
  };
  const { host, app } = await mount({
    factory, items: rows(100), item: { height: 40, template },
  });
  try {
    expect(calls).toBe(1);
    expect(host.querySelector<HTMLElement>(".vlist-viewport")!.style.touchAction).toBe("pan-x pinch-zoom");
    // 3.0 wires only what the config asks for: no feature fields, no plugins.
    expect(pluginNames).toEqual([]);
  } finally { app.unmount(); host.remove(); }
});
