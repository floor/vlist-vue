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
export type { VListConfig, VListFactory } from "vlist/config";

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

    // No type argument: vlist 3 takes two (the item and the config, so the
    // instance carries the methods the config's feature fields imply), and
    // both are inferred from the argument.
    instance.value = createVListFromConfig({ ...config, container });
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
  let unsub: Unsubscribe | undefined;

  // The list is created in onMounted, so the watch callback runs outside
  // setup: the unmount hook is registered here, during setup, instead.
  watch(
    () => instanceRef.value,
    (instance) => {
      unsub?.();
      unsub = instance?.on(event, (payload) => handlerRef.value(payload));
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    unsub?.();
    unsub = undefined;
  });
}
