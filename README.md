# vlist-vue

Vue composable for [vlist](https://github.com/floor/vlist) — lightweight, zero-dependency virtual scrolling.

## Install

```bash
npm install vlist vlist-vue
```

## Quick Start

```vue
<script setup>
import { useVList } from 'vlist-vue';
import 'vlist/styles';

const { containerRef, instance } = useVList({
  item: {
    height: 48,
    template: (user) => `<div class="user">${user.name}</div>`,
  },
  items: users,
});
</script>

<template>
  <div ref="containerRef" style="height: 400px" />
</template>
```

## API

- **`useVList(config)`** — Creates a virtual list. Returns `{ containerRef, instance }`. Config can be a plain object or a reactive `Ref` for automatic updates.
- **`useVListEvent(instance, event, handler)`** — Subscribe to vlist events with automatic cleanup.

Config accepts all [vlist options](https://vlist.dev/docs/api/reference) minus `container` (handled by the ref). Feature fields like `adapter`, `grid`, `groups`, `selection`, `scrollbar`, and `estimatedHeight` are resolved into plugins automatically.

## Documentation

Full usage guide, feature config examples, and TypeScript types: **[Framework Adapters — Vue](https://vlist.dev/docs/frameworks#vue)**

## Synthetic input

Every list scrolls natively by default, and hands itself to synthetic input past the browser's element size limit: `scroll.mode` is `"auto"`. Pass `scroll: { mode: "synthetic" }` for synthetic input from the start, or `"native"` to stay native; the adapter forwards `scroll` unchanged through `vlist/config`. A synthetic list draws its own scrollbar. Requires `vlist ^3.1.0-next.2`; on 3.0.0, pass `factory: createVList` from the deprecated `vlist/synthetic`. A carousel honours `"synthetic"` too. `VListFactory` is re-exported for typed custom factories.

```vue
<script setup lang="ts">
import { useVList } from "vlist-vue";

const items = Array.from({ length: 1000 }, (_, id) => ({ id }));
const { containerRef } = useVList({
  items,
  item: { height: 48, template: item => String(item.id) },
  scroll: { mode: "synthetic" },
});
</script>

<template>
  <div ref="containerRef" style="height: 400px" />
</template>
```

## License

MIT © [Floor IO](https://floor.io)
