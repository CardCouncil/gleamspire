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
  const deckLists = ref<string[]>([])
  const cardPrintings = ref<CardPrinting[]>([])
  const checkedCards = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const setMetadata = ref<Map<string, SetMetadata>>(new Map())
  const selectedSetTypes = ref<Set<string>>(new Set(['expansion', 'core']))
  const isInitialized = ref(false)

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
        const aDate = Math.max(...a.cards.map(card => new Date(card.releaseDate).getTime()))
        const bDate = Math.max(...b.cards.map(card => new Date(card.releaseDate).getTime()))
        return bDate - aDate
      })
  })

  async function addDeckList(list: string) {
    await initializeSetMetadata()
    deckLists.value.push(list)
    await processNewDeckList(list)
  }

  async function processNewDeckList(list: string) {
    isLoading.value = true
    error.value = null
    
    try {
      const cardNames = list
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .map(line => line.replace(/^\d+x?\s+/, ''))
        .filter(Boolean)

      for (const cardName of cardNames) {
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

  function toggleCard(setCode: string, number: string) {
    const card = cardPrintings.value.find(
      c => c.setCode === setCode && c.number === number
    )
    if (card) {
      const isChecked = checkedCards.value.has(card.cardName)
      if (isChecked) {
        checkedCards.value.delete(card.cardName)
      } else {
        checkedCards.value.add(card.cardName)
      }
    }
  }

  function clearAll() {
    deckLists.value = []
    cardPrintings.value = []
    checkedCards.value.clear()
    error.value = null
  }

  return {
    deckLists,
    cardPrintings,
    checkedCards,
    isLoading,
    error,
    selectedSetTypes,
    groupedBySet,
    addDeckList,
    toggleCard,
    clearAll
  }
})