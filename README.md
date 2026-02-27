# vlist-vue

Vue composable for [@floor/vlist](https://github.com/floor/vlist) — lightweight, zero-dependency virtual scrolling.

## Install

```bash
npm install @floor/vlist vlist-vue
```

## Quick Start

```vue
<script setup>
import { useVList } from 'vlist-vue';
import '@floor/vlist/styles';

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

Config accepts all [@floor/vlist options](https://vlist.dev/docs/api/reference) minus `container` (handled by the ref). Feature fields like `adapter`, `grid`, `groups`, `selection`, and `scrollbar` are translated into `.use(withX())` calls automatically.

## Documentation

Full usage guide, feature config examples, and TypeScript types: **[Framework Adapters — Vue](https://vlist.dev/docs/frameworks#vue)**

## License

MIT © [Floor IO](https://floor.io)