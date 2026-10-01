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
import { createApp, h, nextTick, ref, type ShallowRef } from "vue";
import { useVList, useVListEvent } from "./index";
import { autosize, createVList, selection, type VListItem, type VList } from "vlist";

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
      this.cb([{
        target,
        contentRect: { width: VIEWPORT_W, height: VIEWPORT_H } as DOMRectReadOnly,
        // A real ResizeObserverEntry carries both, and autosize() measures
        // the border box. Without this the shim crashes it.
        borderBoxSize: [{ inlineSize: VIEWPORT_W, blockSize: VIEWPORT_H }] as unknown as readonly ResizeObserverSize[],
      } as ResizeObserverEntry], this as unknown as ResizeObserver);
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
    // estimatedHeight auto-wires autosize; the user passes autosize() as well.
    // Must not throw "Duplicate plugin". (Until 3.0 this also passed grid(),
    // which declares a conflict with autosize — a combination vlist refuses
    // by design, and beside the point of #119.)
    const { host, app, captured } = await mount({
      item: { estimatedHeight: 200, template },
      items: rows(200),
      plugins: [autosize(), selection({ mode: "single" })],
    });
    expect(captured.instance?.value).not.toBeNull();
    // It ran rather than throwing: items are on screen.
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
  // A factory from the deprecated vlist/synthetic still selects synthetic input
  // (scroll.mode does it on the one entry, below). A feature field still
  // resolves to a plugin, which is what proves the composable forwards them.
  const { host, app } = await mount({
    factory, items: rows(100), item: { height: 40, template }, selection: { mode: "single" },
  });
  try {
    expect(calls).toBe(1);
    expect(host.querySelector<HTMLElement>(".vlist-viewport")!.style.touchAction).toBe("pan-x pinch-zoom");
    expect(pluginNames).toEqual(["selection"]);
  } finally { app.unmount(); host.remove(); }
});

it("forwards scroll.mode: the list goes synthetic and draws its scrollbar", async () => {
  const { host, app } = await mount({
    items: rows(100), item: { height: 40, template }, scroll: { mode: "synthetic" },
  });
  try {
    // The driver loads on first need: wait for the handoff.
    const viewport = host.querySelector<HTMLElement>(".vlist-viewport")!;
    for (let i = 0; i < 200 && viewport.style.touchAction !== "pan-x pinch-zoom"; i++) await new Promise(r => setTimeout(r, 5));
    expect(viewport.style.touchAction).toBe("pan-x pinch-zoom");
    expect(host.querySelectorAll(".vlist-scrollbar")).toHaveLength(1);
  } finally { app.unmount(); host.remove(); }
});

describe("3.1 compat: the config API on vlist/vue", () => {
  it("resolves a feature field to its plugin", async () => {
    const { app, captured } = await mount({ item: { height: 40, template }, items: rows(10), selection: { mode: "single" } });
    const list = captured.instance!.value as unknown as { select(id: string): void; getSelected(): unknown[] };
    list.select("row-2");
    expect(list.getSelected()).toEqual(["row-2"]);
    app.unmount();
  });

  it("updates the list when a Ref config's items change", async () => {
    const config = ref({ item: { height: 40, template }, items: rows(3) });
    const { host, app } = await mount(config);
    expect(host.querySelectorAll(".row").length).toBe(3);
    config.value = { ...config.value, items: rows(5) };
    await nextTick();
    await flush();
    expect(host.querySelectorAll(".row").length).toBe(5);
    app.unmount();
  });

  it("useVListEvent receives events and unsubscribes on unmount (3.0.1's fix)", async () => {
    let offs = 0;
    const factory: VListFactory<Row> = (config, plugins = []) => {
      const list = createVList(config, plugins);
      const on = list.on.bind(list);
      list.on = ((event, handler) => {
        const off = on(event, handler);
        return () => { offs++; off(); };
      }) as typeof list.on;
      return list;
    };
    const clicked: string[] = [];
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args[0]); };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({
      setup() {
        const { containerRef, instance } = useVList<Row>({ factory, items: rows(10), item: { height: 40, template } });
        useVListEvent(instance, "item:click", ({ item }) => { clicked.push(item.id); });
        return () => h("div", { ref: containerRef, style: { height: `${VIEWPORT_H}px` } });
      },
    });
    try {
      app.mount(host);
      await nextTick();
      await flush();
      host.querySelector<HTMLElement>('[data-index="2"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(clicked).toEqual(["row-2"]);
      app.unmount();
      expect(offs).toBe(1);
      expect(warnings).toEqual([]);
    } finally {
      console.warn = warn;
      host.remove();
    }
  });
});
