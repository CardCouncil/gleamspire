<script setup lang="ts">
import { useSymbolStore } from '../stores/symbols'
import { computed, onMounted } from 'vue'

const props = defineProps<{
  text: string
}>()

const symbolStore = useSymbolStore()

onMounted(async () => {
  await symbolStore.loadSymbols()
})

const symbolPattern = /{[^}]+}/g

const renderedText = computed(() => {
  if (symbolStore.isLoading || symbolStore.symbols.size === 0) return props.text

  return props.text.replace(symbolPattern, (match) => {
    const symbol = symbolStore.symbols.get(match)
    if (!symbol) return match

    return `<img src="${symbol.svg_uri}" alt="${symbol.english}" class="inline-block h-[1em] align-text-bottom" />`
  })
})
</script>

<template>
  <span v-html="renderedText"></span>
</template>