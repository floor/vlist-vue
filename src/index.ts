// vlist-vue
/**
 * Vue composable for vlist - lightweight virtual scrolling
 *
 * @packageDocumentation
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
  VList,
  VListEvents,
  EventHandler,
  Unsubscribe,
} from "@floor/vlist";
import { vlist } from "@floor/vlist";
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

// =============================================================================
// Types
// =============================================================================

/** Configuration for useVList (VListConfig without container) */
export type UseVListConfig<T extends VListItem = VListItem> = Omit<
  VListConfig<T>,
  "container"
>;

/** Return value from the useVList composable */
export interface UseVListReturn<T extends VListItem = VListItem> {
  /** Template ref to attach to your container element */
  containerRef: Ref<HTMLDivElement | null>;
  /** Reactive ref to the vlist instance */
  instance: ShallowRef<VList<T> | null>;
}

// =============================================================================
// Composable
// =============================================================================

/**
 * Vue composable for vlist integration.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useVList } from 'vlist-vue';
 * import { ref } from 'vue';
 *
 * const users = ref([...]);
 *
 * const { containerRef, instance } = useVList({
 *   item: {
 *     height: 48,
 *     template: (user) => `<div>${user.name}</div>`,
 *   },
 *   items: users,
 * });
 * </script>
 *
 * <template>
 *   <div ref="containerRef" style="height: 400px" />
 * </template>
 * ```
 */
export function useVList<T extends VListItem = VListItem>(
  configInput: UseVListConfig<T> | Ref<UseVListConfig<T>>,
): UseVListReturn<T> {
  const containerRef = ref<HTMLDivElement | null>(null);
  const instance = shallowRef<VList<T> | null>(null);

  // Create instance on mount
  onMounted(() => {
    const container = containerRef.value;
    if (!container) return;

    const config = unref(configInput);

    // Build vlist with plugins
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
      builder = builder.use(withSections(config.groups));
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

    instance.value = builder.build() as VList<T>;
  });

  onBeforeUnmount(() => {
    instance.value?.destroy();
    instance.value = null;
  });

  // Sync items when config changes (if config is reactive)
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

/**
 * Subscribe to vlist events within Vue lifecycle
 *
 * @example
 * ```vue
 * <script setup>
 * const { instance } = useVList(config);
 *
 * useVListEvent(instance, 'selection:change', ({ selected }) => {
 *   console.log('Selected:', selected);
 * });
 * </script>
 * ```
 */
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

      // Cleanup when instance changes or component unmounts
      onBeforeUnmount(() => {
        unsub();
      });
    },
    { immediate: true },
  );
}
