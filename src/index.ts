// vlist-vue
/**
 * Vue composable for vlist - lightweight virtual scrolling
 */

import {
  ref,
  shallowRef,
  onMounted,
  onBeforeUnmount,
  watch,
  isRef,
  unref,
  type Ref,
  type ShallowRef,
} from "vue";
import type {
  VListItem,
  VListEvents,
  EventHandler,
  Unsubscribe,
} from "vlist";
import {
  createVList as createVListCore,
  page,
  autosize,
  data as dataPlugin,
  grid,
  masonry,
  groups,
  selection,
  scale,
  scrollbar,
  snapshots,
} from "vlist";
import type { VList, VListPlugin, CreateVListConfig } from "vlist";

// Re-export types that appear in UseVListConfig / UseVListReturn
export type {
  VListItem,
  VListEvents,
  VList,
  CreateVListConfig,
  ItemConfig,
  ItemTemplate,
  EventHandler,
  Unsubscribe,
} from "vlist";

export type UseVListConfig<T extends VListItem = VListItem> = Omit<
  CreateVListConfig<T>,
  "container"
>;

export interface UseVListReturn<T extends VListItem = VListItem> {
  containerRef: Ref<HTMLDivElement | null>;
  instance: ShallowRef<VList<T> | null>;
}

export function useVList<T extends VListItem = VListItem>(
  configInput: UseVListConfig<T> | Ref<UseVListConfig<T>>,
): UseVListReturn<T> {
  const containerRef = ref<HTMLDivElement | null>(null);
  const instance = shallowRef<VList<T> | null>(null);

  onMounted(() => {
    const container = containerRef.value;
    if (!container) return;

    const config = unref(configInput);

    const plugins: VListPlugin<T>[] = [];

    if (config.scroll?.element === window) {
      plugins.push(page());
    }

    const item = config.item;
    const isHorizontal = config.orientation === "horizontal";
    const hasExplicitSize = isHorizontal ? item.width != null : item.height != null;
    const hasEstimate = isHorizontal
      ? (item as unknown as Record<string, unknown>).estimatedWidth != null
      : (item as unknown as Record<string, unknown>).estimatedHeight != null;
    if (!hasExplicitSize && hasEstimate) {
      plugins.push(autosize());
    }

    if (config.adapter) {
      plugins.push(
        dataPlugin({
          adapter: config.adapter,
          ...(config.loading && { loading: config.loading }),
        }),
      );
    }

    if (config.layout === "grid" && config.grid) {
      plugins.push(grid(config.grid));
    }

    if (config.layout === "masonry" && config.masonry) {
      plugins.push(masonry(config.masonry));
    }

    if (config.groups) {
      const groupsConfig = config.groups;
      const headerHeight =
        typeof groupsConfig.headerHeight === "function"
          ? groupsConfig.headerHeight("", 0)
          : groupsConfig.headerHeight;
      plugins.push(
        groups({
          getGroupForIndex: groupsConfig.getGroupForIndex,
          headerHeight,
          headerTemplate: groupsConfig.headerTemplate,
          ...(groupsConfig.sticky !== undefined && { sticky: groupsConfig.sticky }),
        }),
      );
    }

    const selectionMode = config.selection?.mode || "none";
    if (selectionMode !== "none") {
      plugins.push(selection(config.selection));
    } else {
      plugins.push(selection({ mode: "none" }));
    }

    plugins.push(scale());

    const scrollbarConfig = config.scroll?.scrollbar || config.scrollbar;
    if (scrollbarConfig !== "none") {
      const scrollbarOptions =
        typeof scrollbarConfig === "object" ? scrollbarConfig : {};
      plugins.push(scrollbar(scrollbarOptions));
    }

    plugins.push(snapshots());

    instance.value = createVListCore<T>({ ...config, container }, plugins);
  });

  onBeforeUnmount(() => {
    instance.value?.destroy();
    instance.value = null;
  });

  if (isRef(configInput)) {
    watch(
      () => configInput.value.items,
      (newItems) => {
        if (instance.value && newItems) {
          instance.value.setItems(newItems);
        }
      },
    );
  }

  return {
    containerRef,
    instance,
  };
}

export function useVListEvent<
  T extends VListItem,
  K extends keyof VListEvents<T>,
>(
  instanceRef: Ref<VList<T> | null> | ShallowRef<VList<T> | null>,
  event: K,
  handler: EventHandler<VListEvents<T>[K]>,
): void {
  const handlerRef = ref(handler);

  watch(
    () => instanceRef.value,
    (instance) => {
      if (!instance) return;

      const wrappedHandler: EventHandler<VListEvents<T>[K]> = (payload) => {
        handlerRef.value(payload);
      };

      const unsub: Unsubscribe = instance.on(event, wrappedHandler);

      onBeforeUnmount(() => {
        unsub();
      });
    },
    { immediate: true },
  );
}
