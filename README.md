# vlist-vue

Vue composable for [vlist](https://github.com/floor/vlist) - lightweight, zero-dependency virtual scrolling.

## Installation

```bash
npm install @floor/vlist vlist-vue
```

## Usage

### Composition API

```vue
<script setup>
import { useVList } from 'vlist-vue';
import '@floor/vlist/styles';

const users = ref([...]);

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

### Options API

```vue
<script>
import { useVList } from 'vlist-vue';

export default {
  setup() {
    return useVList({
      item: {
        height: 48,
        template: (user) => `<div>${user.name}</div>`,
      },
      items: [],
    });
  },
};
</script>
```

## API

### `useVList(config)`

**Parameters:**
- `config` - VList configuration (same as core vlist, minus `container`)
  - Can be a reactive `Ref` for automatic updates

**Returns:**
- `containerRef` - Template ref for the container
- `instance` - Reactive ref to the vlist instance

## Documentation

For full documentation, see [vlist.dev](https://vlist.dev)

## License

MIT © [Floor IO](https://floor.io)
