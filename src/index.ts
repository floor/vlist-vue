// vlist-vue
/**
 * Vue composable for vlist - lightweight virtual scrolling
 *
 * Deprecated: use `vlist/vue` from the vlist package, which takes features as
 * plugins (`useVList({ items, item }, [selection()])`). This package keeps the
 * config-based API on top of it: the composables are `vlist/vue`'s, building
 * the list with `createVListFromConfig` so feature fields still resolve to
 * plugins.
 */

import type { Ref, ShallowRef } from "vue";
import type { VListItem, VList } from "vlist";
import { createVListFromConfig, type VListConfig } from "vlist/config";
import { useVList as useEntry, useVListEvent } from "vlist/vue";

export { useVListEvent };

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

/** `vlist/vue`'s factory argument: builds from the whole config. */
const fromConfig = createVListFromConfig as unknown as Parameters<typeof useEntry>[2];

export function useVList<T extends VListItem = VListItem>(
  configInput: UseVListConfig<T> | Ref<UseVListConfig<T>>,
): UseVListReturn<T> {
  return useEntry<T>(configInput as Parameters<typeof useEntry<T>>[0], [], fromConfig) as UseVListReturn<T>;
}
