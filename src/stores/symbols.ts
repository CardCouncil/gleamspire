import { defineStore } from 'pinia'
import { ref } from 'vue'

interface SymbolData {
  symbol: string
  svg_uri: string
  english: string
  represents_mana: boolean
  appears_in_mana_costs: boolean
  cmc: number | null
  loose_variant?: string | null
  transposable?: boolean
}

export const useSymbolStore = defineStore('symbols', () => {
  const symbols = ref<Map<string, SymbolData>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadSymbols() {
    if (symbols.value.size > 0) return

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('https://api.scryfall.com/symbology')
      if (!response.ok) throw new Error('Failed to fetch symbols')
      const data = await response.json()

      data.data.forEach((symbol: SymbolData) => {
        symbols.value.set(symbol.symbol, symbol)
      })
    } catch (e) {
      console.error('Error loading symbols:', e)
      error.value = 'Failed to load mana symbols'
    } finally {
      isLoading.value = false
    }
  }

  return {
    symbols,
    isLoading,
    error,
    loadSymbols
  }
})