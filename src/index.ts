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
import type { VList } from "vlist";
import { createVListFromConfig, type VListConfig } from "vlist/config";

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
export type { VListConfig } from "vlist/config";

/**
 * Configuration for {@link useVList}. vlist's high-level `VListConfig` (feature
 * fields like `layout`, `grid`, `selection`, `plugins` are translated into
 * plugins automatically) minus `container`, which the composable owns via a ref.
 */
export type UseVListConfig<T extends VListItem = VListItem> = VListConfig<T>;

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

    instance.value = createVListFromConfig<T>({ ...config, container });
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
