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
import { createVListFromConfig, type VListConfig, type ConfigItem, type ConfigMethods } from "vlist/config";

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
export type { VListConfig, VListFactory, ConfigItem, ConfigMethods } from "vlist/config";

/**
 * Configuration for {@link useVList}. vlist's high-level `VListConfig` (feature
 * fields like `layout`, `grid`, `selection`, `plugins` are translated into
 * plugins automatically) minus `container`, which the composable owns via a ref.
 */
export type UseVListConfig<T extends VListItem = VListItem> = VListConfig<T>;

/**
 * The list a config builds: its item type read from `items` or the template,
 * and the methods its feature fields wire — `selection` brings `select()`,
 * `adapter` brings `reload()`, `layout: "grid"` brings `getGridLayout()`.
 */
export type UseVListInstance<C extends UseVListConfig<any>> =
  VList<ConfigItem<C>> & ConfigMethods<ConfigItem<C>, C>;

export interface UseVListReturn<C extends UseVListConfig<any>> {
  containerRef: Ref<HTMLDivElement | null>;
  instance: ShallowRef<UseVListInstance<C> | null>;
}

/**
 * One type parameter, the config itself, inferred from the argument (or from
 * the ref's value). Do not pass a type argument: the item type comes from
 * `items` or `item.template`, and the plugin methods from the feature fields.
 */
export function useVList<const C extends UseVListConfig<any>>(
  configInput: C | Ref<C>,
): UseVListReturn<C> {
  const containerRef = ref<HTMLDivElement | null>(null);
  // Cast rather than parameterise: shallowRef's overloads cannot tell a
  // generic instance type from a Ref, and widen the result to a union.
  const instance = shallowRef(null) as ShallowRef<UseVListInstance<C> | null>;

  onMounted(() => {
    const container = containerRef.value;
    if (!container) return;

    const config = unref(configInput);

    instance.value = createVListFromConfig({ ...config, container }) as UseVListInstance<C>;
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
