import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSymbology, type ScryfallCardSymbol } from '../services/scryfall'

export const useSymbolStore = defineStore('symbols', () => {
  const symbols = ref<Map<string, ScryfallCardSymbol>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Many ManaSymbols components mount at once; share one in-flight load
  let loadPromise: Promise<void> | null = null

  function loadSymbols(): Promise<void> {
    if (symbols.value.size > 0) return Promise.resolve()
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      isLoading.value = true
      error.value = null

      try {
        const data = await getSymbology()
        data.forEach((symbol) => {
          symbols.value.set(symbol.symbol, symbol)
        })
      } catch (e) {
        console.error('Error loading symbols:', e)
        error.value = 'Failed to load mana symbols'
        loadPromise = null
      } finally {
        isLoading.value = false
      }
    })()

    return loadPromise
  }

  return {
    symbols,
    isLoading,
    error,
    loadSymbols
  }
})
