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
  VListConfig,
  VListItem,
  VListEvents,
  EventHandler,
  Unsubscribe,
} from "@floor/vlist";
import { vlist, type BuiltVList } from "@floor/vlist";
import {
  withAsync,
  withGrid,
  withSections,
  withSelection,
  withScrollbar,
  withScale,
  withSnapshots,
  withPage,
} from "@floor/vlist";

export type UseVListConfig<T extends VListItem = VListItem> = Omit<
  VListConfig<T>,
  "container"
>;

export interface UseVListReturn<T extends VListItem = VListItem> {
  containerRef: Ref<HTMLDivElement | null>;
  instance: ShallowRef<BuiltVList<T> | null>;
}

export function useVList<T extends VListItem = VListItem>(
  configInput: UseVListConfig<T> | Ref<UseVListConfig<T>>,
): UseVListReturn<T> {
  const containerRef = ref<HTMLDivElement | null>(null);
  const instance = shallowRef<BuiltVList<T> | null>(null);

  onMounted(() => {
    const container = containerRef.value;
    if (!container) return;

    const config = unref(configInput);

    let builder = vlist<T>({
      ...config,
      container,
    });

    if (config.scroll?.element === window) {
      builder = builder.use(withPage());
    }

    if (config.adapter) {
      builder = builder.use(
        withAsync({
          adapter: config.adapter,
          ...(config.loading && { loading: config.loading }),
        }),
      );
    }

    if (config.layout === "grid" && config.grid) {
      builder = builder.use(withGrid(config.grid));
    }

    if (config.groups) {
      const groupsConfig = config.groups;
      const headerHeight =
        typeof groupsConfig.headerHeight === "function"
          ? groupsConfig.headerHeight("", 0)
          : groupsConfig.headerHeight;

      builder = builder.use(
        withSections({
          getGroupForIndex: groupsConfig.getGroupForIndex,
          headerHeight,
          headerTemplate: groupsConfig.headerTemplate,
          ...(groupsConfig.sticky !== undefined && {
            sticky: groupsConfig.sticky,
          }),
        }),
      );
    }

    const selectionMode = config.selection?.mode || "none";
    if (selectionMode !== "none") {
      builder = builder.use(withSelection(config.selection));
    } else {
      builder = builder.use(withSelection({ mode: "none" }));
    }

    builder = builder.use(withScale());

    const scrollbarConfig = config.scroll?.scrollbar || config.scrollbar;
    if (scrollbarConfig !== "none") {
      const scrollbarOptions =
        typeof scrollbarConfig === "object" ? scrollbarConfig : {};
      builder = builder.use(withScrollbar(scrollbarOptions));
    }

    builder = builder.use(withSnapshots());

    instance.value = builder.build();
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
  instanceRef: Ref<BuiltVList<T> | null> | ShallowRef<BuiltVList<T> | null>,
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
