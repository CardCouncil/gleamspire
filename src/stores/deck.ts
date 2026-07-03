import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { watch } from 'vue'
import {
  getSets,
  searchPrintingsByNames,
  SEARCH_CHUNK_SIZE,
  ScryfallRateLimitError,
  type ScryfallCard
} from '../services/scryfall'

interface SetGroup {
  cards: CardPrinting[]
  symbolUrl: string
}

interface CardPrinting {
  setName: string
  setCode: string
  cardName: string
  manaCost: string
  colorIdentity: string[]
  typeLine: string
  rarity: string
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
  const warnings = ref<string[]>([])
  const loadedCount = ref(0)
  const totalCount = ref(0)
  const setMetadata = ref<Map<string, SetMetadata>>(new Map())
  const selectedSetTypes = ref<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('selectedSetTypes') || '["expansion","core","commander","duel_deck","starter","planechase","premium_deck","from_the_vault","masters","memorabilia","box","spellbook","alchemy","archenemy","draft_innovation"]')
  ))
  const selectedSets = ref<Set<string>>(new Set())
  const setOrderBy = ref<'releaseDate' | 'cardCount'>('releaseDate')
  const cardSortBy = ref<'name' | 'color_identity' | 'type_line' | 'rarity'>('name')

  const colorOrder = ['W', 'U', 'B', 'R', 'G']
  const rarityOrder = ['mythic', 'rare', 'uncommon', 'common', 'special']
  const basicLandNames = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'])

  // Printings fetched this session, keyed by lowercased card name — Scryfall
  // asks clients to cache, and this makes re-running an edited list instant
  const printingsCache = new Map<string, CardPrinting[]>()

  function sortCards(a: CardPrinting, b: CardPrinting): number {
    switch (cardSortBy.value) {
      case 'color_identity':
        const colorA = a.colorIdentity.length === 0 ? ['C'] : a.colorIdentity
        const colorB = b.colorIdentity.length === 0 ? ['C'] : b.colorIdentity
        const firstColorA = colorA[0]
        const firstColorB = colorB[0]
        const colorCompare = (colorOrder.indexOf(firstColorA) - colorOrder.indexOf(firstColorB))
        return colorCompare !== 0 ? colorCompare : a.cardName.localeCompare(b.cardName)
      
      case 'type_line':
        return a.typeLine.localeCompare(b.typeLine) || 
               a.cardName.localeCompare(b.cardName)
      
      case 'rarity':
        const rarityCompare = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
        return rarityCompare !== 0 ? rarityCompare : a.cardName.localeCompare(b.cardName)
      
      default: // 'name'
        return a.cardName.localeCompare(b.cardName)
    }
  }

  // Watch for changes to selectedSetTypes and save to localStorage
  watch(
    selectedSetTypes,
    (newTypes) => {
      localStorage.setItem('selectedSetTypes', JSON.stringify(Array.from(newTypes)))
    },
    { deep: true }
  )

  // Single in-flight promise: concurrent callers await the same load, and a
  // failed load can be retried on the next call
  let initPromise: Promise<void> | null = null

  function initializeSetMetadata(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const sets = await getSets()
          sets.forEach((set) => {
            setMetadata.value.set(set.code, set)
          })
        } catch (e) {
          initPromise = null
          console.error('Error fetching sets metadata:', e)
          error.value = 'Error loading set data: ' + (e as Error).message
        }
      })()
    }
    return initPromise
  }

  const groupedBySet = computed(() => {
    const groups: { [key: string]: SetGroup } = {}
    
    const filteredPrintings = cardPrintings.value?.filter(card => 
      (selectedSetTypes.value.has(card.setType) && 
       (selectedSets.value.size === 0 || selectedSets.value.has(card.setCode)))
    ) || []

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

    // Sort cards within each group
    Object.values(groups).forEach(group => {
      group.cards.sort(sortCards)
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

  function decrementCard(cardName: string) {
    const currentCount = selectedPrintings.value.get(cardName) || 0
    if (currentCount > 0) {
      selectedPrintings.value.set(cardName, currentCount - 1)
    }
  }

  function toCardPrinting(card: ScryfallCard): CardPrinting {
    return {
      setName: card.set_name,
      setCode: card.set,
      cardName: card.name,
      manaCost: card.mana_cost || '',
      colorIdentity: card.color_identity || [],
      typeLine: card.type_line?.split('—')[0].trim() || '',
      rarity: card.rarity || '',
      number: card.collector_number,
      setType: card.set_type,
      releaseDate: card.released_at
    }
  }

  // If the user typed a face name ("Fable of the Mirror-Breaker") or wrong
  // casing, re-key the deck list entry to Scryfall's canonical card name so
  // required-count lookups (which use cardName) line up. Only safe when the
  // name resolved to exactly one card.
  function reconcileDeckListName(requestedName: string, printings: CardPrinting[]) {
    const canonical = printings[0]?.cardName
    if (!canonical || canonical === requestedName) return
    if (!printings.every(p => p.cardName === canonical)) return
    if (!currentDeckList.value.has(requestedName)) return
    const quantity = currentDeckList.value.get(requestedName)!
    currentDeckList.value.delete(requestedName)
    currentDeckList.value.set(canonical, (currentDeckList.value.get(canonical) || 0) + quantity)
  }

  function appendPrintings(printings: CardPrinting[]) {
    // Add only unique printings
    printings.forEach((printing) => {
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

  async function addDeckList(list: string) {
    // Clear previous data
    currentDeckList.value.clear()
    cardPrintings.value = []
    selectedPrintings.value.clear()
    error.value = null
    warnings.value = []
    loadedCount.value = 0
    totalCount.value = 0
    isLoading.value = true

    try {
      // Initialize set metadata first
      await initializeSetMetadata()

      // Parse deck list
      const lines = list
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && line !== '')

      // Process each line to extract quantity and card name
      for (const line of lines) {
        let quantity = 1
        let cardName = line

        // Check if line starts with a number
        const match = line.match(/^(\d+)x?\s+(.+)$/)
        if (match) {
          quantity = parseInt(match[1])
          cardName = match[2]
        }

        // Skip basic lands
        if (basicLandNames.has(cardName)) continue

        currentDeckList.value.set(cardName, quantity)
      }

      // The Map already dedupes repeated lines; serve cached names instantly
      const uniqueNames = Array.from(currentDeckList.value.keys())
      totalCount.value = uniqueNames.length

      const namesToFetch: string[] = []
      for (const name of uniqueNames) {
        const cached = printingsCache.get(name.toLowerCase())
        if (cached) {
          appendPrintings(cached)
          reconcileDeckListName(name, cached)
          loadedCount.value++
        } else {
          namesToFetch.push(name)
        }
      }

      // Fetch the rest in batched, rate-limited search queries
      const notFoundNames: string[] = []
      for (let i = 0; i < namesToFetch.length; i += SEARCH_CHUNK_SIZE) {
        const chunk = namesToFetch.slice(i, i + SEARCH_CHUNK_SIZE)
        const { byName, notFound } = await searchPrintingsByNames(chunk)

        byName.forEach((cards, name) => {
          const printings = cards
            .map(toCardPrinting)
            .sort((a, b) =>
              a.setName.localeCompare(b.setName) ||
              a.number.localeCompare(b.number)
            )
          printingsCache.set(name.toLowerCase(), printings)
          appendPrintings(printings)
          reconcileDeckListName(name, printings)
          loadedCount.value++
        })

        notFoundNames.push(...notFound)
        loadedCount.value += notFound.length
      }

      if (notFoundNames.length > 0) {
        warnings.value = ['Not found on Scryfall (check spelling): ' + notFoundNames.join(', ')]
      }
    } catch (e) {
      console.error('Error processing deck list:', e)
      if (e instanceof ScryfallRateLimitError) {
        error.value = 'Scryfall rate limit hit. Please wait about 30 seconds and try again.'
      } else {
        error.value = 'Error processing deck list: ' + (e as Error).message
      }
    } finally {
      isLoading.value = false
    }
  }

  function clearAll() {
    currentDeckList.value.clear()
    cardPrintings.value = []
    selectedPrintings.value.clear()
    error.value = null
    warnings.value = []
    loadedCount.value = 0
    totalCount.value = 0
  }

  return {
    initializeSetMetadata,
    setMetadata,
    currentDeckList,
    cardPrintings,
    selectedPrintings,
    isLoading,
    cardSortBy,
    selectedSets,
    error,
    warnings,
    loadedCount,
    totalCount,
    selectedSetTypes,
    groupedBySet,
    setOrderBy,
    addDeckList,
    incrementCard,
    decrementCard,
    getCardCount,
    getRequiredCount,
    clearAll
  }
})