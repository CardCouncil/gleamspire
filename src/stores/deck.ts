import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface SetGroup {
  cards: CardPrinting[]
  symbolUrl: string
}

interface CardPrinting {
  setName: string
  setCode: string
  cardName: string
  number: string
  setType: string
  releaseDate: string
}

interface SetMetadata {
  name: string
  code: string
  icon_svg_uri: string
  released_at: string
}

export const useDeckStore = defineStore('deck', () => {
  const currentDeckList = ref<Map<string, number>>(new Map())
  const cardPrintings = ref<CardPrinting[]>([])
  const selectedPrintings = ref<Map<string, number>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const setMetadata = ref<Map<string, SetMetadata>>(new Map())
  const selectedSetTypes = ref<Set<string>>(new Set(['expansion', 'core']))
  const isInitialized = ref(false)
  const setOrderBy = ref<'releaseDate' | 'cardCount'>('releaseDate')

  async function initializeSetMetadata() {
    if (!isInitialized.value) {
      isInitialized.value = true
      try {
        const response = await fetch('https://api.scryfall.com/sets')
        if (!response.ok) throw new Error('Failed to fetch sets data')
        const data = await response.json()
        
        data.data.forEach((set: SetMetadata) => {
          setMetadata.value.set(set.code, set)
        })
      } catch (e) {
        console.error('Error fetching sets metadata:', e)
        error.value = 'Error loading set data: ' + (e as Error).message
      }
    }
  }

  const groupedBySet = computed(() => {
    const groups: { [key: string]: SetGroup } = {}
    
    const filteredPrintings = cardPrintings.value.filter(
      card => selectedSetTypes.value.has(card.setType)
    )
    
    filteredPrintings.forEach(card => {
      const key = card.setName
      if (!groups[key]) {
        const set = setMetadata.value.get(card.setCode)
        groups[key] = { cards: [], symbolUrl: set?.icon_svg_uri || '' }
      }
      // Only add if card name doesn't exist in this set yet
      if (!groups[key].cards.some(existing => existing.cardName === card.cardName)) {
        groups[key].cards.push(card)
      }
    })

    // Sort sets by number of cards, descending
    return Object.entries(groups)
      .map(([setName, { cards, symbolUrl }]) => ({ 
        setName, 
        cards,
        symbolUrl 
      }))
      .sort((a, b) => {
        // Get the most recent release date from each set's cards
        if (setOrderBy.value === 'releaseDate') {
          const aDate = Math.max(...a.cards.map(card => new Date(card.releaseDate).getTime()))
          const bDate = Math.max(...b.cards.map(card => new Date(card.releaseDate).getTime()))
          return bDate - aDate
        } else {
          // Sort by card count first, then by set name for equal counts
          const countDiff = b.cards.length - a.cards.length
          return countDiff !== 0 ? countDiff : a.setName.localeCompare(b.setName)
        }
      })
  })

  const getCardCount = (cardName: string) => {
    return selectedPrintings.value.get(cardName) || 0
  }

  const getRequiredCount = (cardName: string) => {
    return currentDeckList.value.get(cardName) || 0
  }

  function incrementCard(cardName: string) {
    const currentCount = selectedPrintings.value.get(cardName) || 0
    const requiredCount = currentDeckList.value.get(cardName) || 0
    if (currentCount < requiredCount) {
      selectedPrintings.value.set(cardName, currentCount + 1)
    }
  }

  async function addDeckList(list: string) {
    // Clear previous data
    currentDeckList.value.clear()
    cardPrintings.value = []
    selectedPrintings.value.clear()
    
    // Parse deck list
    const lines = list
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
    
    // Process each line to extract quantity and card name
    lines.forEach(line => {
      const match = line.match(/^(\d+)x?\s+(.+)$/)
      if (match) {
        const [, quantity, cardName] = match
        currentDeckList.value.set(cardName, parseInt(quantity))
      }
    })
  }

  async function loadPrintings() {
    await initializeSetMetadata()
    await processCurrentDeckList()
  }

  async function processCurrentDeckList() {
    isLoading.value = true
    error.value = null
    
    try {
      for (const [cardName, quantity] of currentDeckList.value.entries()) {
        // First, get the exact card to ensure we have the correct name
        const response = await fetch(
          `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(cardName)}"+game:paper&unique=prints`
        )
        const data = await response.json()
        
        if (data.status === 404) {
          continue // Skip cards that aren't found
        }
        
        if (!response.ok) {
          throw new Error(data.details || 'Error fetching card data')
        }

        const newPrintings = data.data
          .map((card: any) => ({
            setName: card.set_name,
            setCode: card.set,
            cardName: card.name,
            number: card.collector_number,
            setType: card.set_type,
            releaseDate: card.released_at
          }))
          .sort((a: CardPrinting, b: CardPrinting) => 
            a.setName.localeCompare(b.setName) || 
            a.number.localeCompare(b.number)
          )

        // Add only unique printings
        newPrintings.forEach((printing: CardPrinting) => {
          const exists = cardPrintings.value.some(
            p => p.setCode === printing.setCode && 
                p.number === printing.number &&
                p.cardName === printing.cardName
          )
          if (!exists) {
            cardPrintings.value.push(printing)
          }
        })
      }
    } catch (e) {
      error.value = 'Error processing deck list: ' + (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  function clearAll() {
    currentDeckList.value.clear()
    cardPrintings.value = []
    selectedPrintings.value.clear()
    error.value = null
  }

  return {
    currentDeckList,
    cardPrintings,
    selectedPrintings,
    isLoading,
    error,
    selectedSetTypes,
    groupedBySet,
    setOrderBy,
    addDeckList,
    incrementCard,
    getCardCount,
    getRequiredCount,
    clearAll,
    loadPrintings
  }
})