<script setup lang="ts">
import { ref } from 'vue'
import logo from '../assets/logo.png'
import bolt from '../assets/bolt.png'
import { useDeckStore } from '../stores/deck'
import SetTypeModal from '../components/SetTypeModal.vue'
import ManaSymbols from '../components/ManaSymbols.vue'
import { computed, onMounted } from 'vue'

const exportRemainingCards = () => {
  const remainingCards = Array.from(deckStore.currentDeckList.entries())
    .filter(([cardName, quantity]) => {
      const collected = deckStore.getCardCount(cardName)
      return collected < quantity
    })
    .map(([cardName, quantity]) => {
      const collected = deckStore.getCardCount(cardName)
      const remaining = quantity - collected
      return `${remaining}x ${cardName}`
    })
    .join('\n')

  // Create and trigger download
  const blob = new Blob([remainingCards], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'buy_list.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const deckStore = useDeckStore()
const newDeckList = ref('')
const showSetTypeModal = ref(false)
const isDeckListExpanded = ref(true)
const orderOptions = [
  { value: 'releaseDate', label: 'Release Date (Newest First)' },
  { value: 'cardCount', label: 'Number of Cards (Most First)' }
] as const

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'color_identity', label: 'Color Identity' },
  { value: 'type_line', label: 'Type' },
  { value: 'rarity', label: 'Rarity' }
] as const

const colorOrder = ['W', 'U', 'B', 'R', 'G']
const rarityOrder = ['mythic', 'rare', 'uncommon', 'common', 'special']

// Track which cards have been selected in which sets
const selectedCardsBySet = ref(new Map<string, Set<string>>())

// Initialize or update the tracking of which card versions are selected
function updateSelectedCardsBySet(cardName: string, setCode: string, isAdding: boolean) {
  if (!selectedCardsBySet.value.has(setCode)) {
    selectedCardsBySet.value.set(setCode, new Set())
  }
  
  const cardsInSet = selectedCardsBySet.value.get(setCode)
  
  if (isAdding) {
    cardsInSet?.add(cardName)
  } else {
    if (deckStore.getCardCount(cardName) === 0) {
      cardsInSet?.delete(cardName)
    }
  }
}

// Determine if a card should be visible based on selection status
function shouldShowCard(cardName: string, setCode: string) {
  const totalRequired = deckStore.getRequiredCount(cardName)
  const totalSelected = deckStore.getCardCount(cardName)
  
  // If we haven't reached the required count, always show all versions
  if (totalSelected < totalRequired) {
    return true
  }
  
  // If this version has been selected at least once, show it
  return selectedCardsBySet.value.get(setCode)?.has(cardName) || false
}

// Override increment and decrement methods to track which versions are selected
function incrementCard(cardName: string, setCode: string) {
  deckStore.incrementCard(cardName)
  updateSelectedCardsBySet(cardName, setCode, true)
}

function decrementCard(cardName: string, setCode: string) {
  deckStore.decrementCard(cardName)
  updateSelectedCardsBySet(cardName, setCode, false)
}

const deckListEntries = computed(() =>
  Array.from(deckStore.currentDeckList.entries()).sort(([a], [b]) => {
    // If we don't have card data yet, sort by name only
    if (!deckStore.cardPrintings || deckStore.cardPrintings.length === 0) {
      return a.localeCompare(b)
    }

    const cardA = deckStore.cardPrintings.find(p => p.cardName === a)
    const cardB = deckStore.cardPrintings.find(p => p.cardName === b)
    
    // If either card is not found, put it at the end
    if (!cardA) return 1
    if (!cardB) return -1
    
    switch (deckStore.cardSortBy) {
      case 'color_identity':
        // Sort by color identity, then name
        const colorA = cardA.colorIdentity.length === 0 ? ['C'] : cardA.colorIdentity
        const colorB = cardB.colorIdentity.length === 0 ? ['C'] : cardB.colorIdentity
        // Compare first colors
        const firstColorA = colorA[0]
        const firstColorB = colorB[0]
        const colorCompare = (colorOrder.indexOf(firstColorA) - colorOrder.indexOf(firstColorB))
        return colorCompare !== 0 ? colorCompare : cardA.cardName.localeCompare(cardB.cardName)
      
      case 'type_line':
        // Sort by type, then name
        return cardA.typeLine.localeCompare(cardB.typeLine) || 
               cardA.cardName.localeCompare(cardB.cardName)
      
      case 'rarity':
        // Sort by rarity order, then name
        const rarityCompare = rarityOrder.indexOf(cardA.rarity) - rarityOrder.indexOf(cardB.rarity)
        return rarityCompare !== 0 ? rarityCompare : cardA.cardName.localeCompare(cardB.cardName)
      
      default: // 'name'
        return cardA.cardName.localeCompare(cardB.cardName)
    }
  })
)

// Filter the cards in each set based on our selection rules
const filteredGroupedBySet = computed(() => {
  return deckStore.groupedBySet.map(group => {
    // Filter cards based on our visibility rules
    const filteredCards = group.cards.filter(card => 
      shouldShowCard(card.cardName, card.setCode)
    )
    
    return {
      ...group,
      cards: filteredCards
    }
  }).filter(group => group.cards.length > 0) // Only show sets that have visible cards
})

async function handleSubmit() {
  if (newDeckList.value.trim()) {
    await deckStore.addDeckList(newDeckList.value)
    newDeckList.value = ''
    // Reset the selected cards tracking when loading a new deck
    selectedCardsBySet.value = new Map()
  }
}

onMounted(async () => {
  await deckStore.initializeSetMetadata()
})
</script>

<template>
  <a
    href="https://bolt.new/"
    target="_blank"
    rel="noopener"
    class="fixed top-4 right-4 w-20 h-20 z-50"
  >
    <img
      :src="bolt"
      alt="Bolt Icon"
      class="w-full h-full drop-shadow-lg bg-white rounded-full p-2 border border-neutral-200"
    />
  </a>
  <div class="max-w-7xl mx-auto md:p-8 p-1 space-y-8 md:text-md md:text-md text-xs">
    <img :src="logo" alt="cardboard tutor logo" class="w-48 h-auto mx-auto mb-4">
    <h1 title="Sir Truffles" class="lg:text-7xl md:text-6xl text-5xl header-font text-center mb-8 bg-clip-text text-transparent bg-transparent lg:text-stroke-5 md:text-stroke-3 text-stroke-2 text-stroke-white">
      Cardboard Tutor
    </h1>
    
    <div class="glass-card md:p-8 p-2 rounded-xl text-center space-y-4">
      <textarea
        v-model="newDeckList"
        :placeholder="'Paste your deck list here\none card per line'"
        rows="10"
        class="w-full p-4 mb-4 font-mono input-field placeholder:text-white "
      ></textarea>
      <div class="flex justify-center gap-4">
        <button 
          @click="handleSubmit" 
          :disabled="deckStore.isLoading"
          class="btn-primary"
        >
          {{ deckStore.isLoading ? 'Processing...' : 'Add' }}
        </button>
        <button 
          @click="showSetTypeModal = true" 
          class="btn-secondary"
        >
          Filter Sets
        </button>
      </div>
    </div>

    <div v-if="deckStore.error" class="p-4 mb-4 text-red-700 bg-red-100 border border-red-300 rounded-lg">
      {{ deckStore.error }}
    </div>

    <div v-if="deckListEntries.length > 0" class="space-y-6">
      <div class="mb-6 md:grid-cols-2 grid-cols-1">
        <button 
          @click="isDeckListExpanded = !isDeckListExpanded"
          class="flex items-center gap-2 group"
        >
          <h2 class="text-2xl header-font bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
            Deck List
          </h2>
          <svg 
            v-if="isDeckListExpanded"
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke-width="1.5" 
            stroke="currentColor" 
            class="size-6 text-xanthous-400 transition-transform group-hover:scale-110"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
          <svg 
            v-else
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke-width="1.5" 
            stroke="currentColor" 
            class="size-6 text-xanthous-400 transition-transform group-hover:scale-110"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        <label class="flex items-center gap-2 md:justify-end">
          <span class="text-sm font-medium">Sort by:</span>
          <select
            v-model="deckStore.cardSortBy"
            class="px-3 py-1.5 rounded-lg text-sm input-field min-w-[120px]"
          >
            <option
              v-for="option in sortOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
      <div 
        v-show="isDeckListExpanded"
        class="glass-card md:p-6 p-1 rounded-xl transition-all duration-300"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          <div
            v-for="[cardName, quantity] in deckListEntries"
            :key="cardName"
            class="p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div class="grid grid-cols-3 gap-2" style="grid-template-columns: 1fr 8fr 3fr;">
              <div 
                class="font-mono text-sm w-10"
                :class="deckStore.getCardCount(cardName) >= quantity ? 'text-ivory/50' : 'text-peach-yellow-300'"
              >
                ({{ deckStore.getCardCount(cardName) }}/{{ quantity }})
              </div>
              <div 
                class="flex items-center gap-2"
                :class="{ 'line-through text-ivory/50': deckStore.getCardCount(cardName) >= quantity }"
              >
                {{ cardName }}{{ ' ' }}
              </div>
              <div
                v-if="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost"
                class="text-sm text-peach-yellow-300 font-mono grow text-right"
              >
                <ManaSymbols 
                  :text="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost || ''"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-center">
          <button
            @click="exportRemainingCards"
            class="btn-secondary"
          >
            Export Remaining
          </button>
        </div>
      </div>
    </div>

    <div v-if="filteredGroupedBySet.length > 0" class="space-y-6">
      <div class="md:grid-cols-2 grid-cols-1 mb-6">
        <h2 class="text-2xl header-font bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
          Card Printings
        </h2>
        <label class="flex items-center gap-2 justify-end">
          <span class="text-sm font-medium">Order sets by:</span>
          <select
            v-model="deckStore.setOrderBy"
            class="px-3 py-1.5 rounded-lg text-sm input-field "
          >
            <option
              v-for="option in orderOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
      <div 
        v-for="group in filteredGroupedBySet" 
        :key="group.setName" 
        class="glass-card md:p-6 p-1 rounded-xl mb-6"
      >
        <h3 class="md:text-xl text-lg  font-medium mb-4">
          <img 
            :src="group.symbolUrl" 
            :alt="`${group.setName} symbol`" 
            class="md:w-6 md:h-6 w-5 h-5 inline-block md:mr-2 invert"
          >
          {{ group.setName }} ({{ group.cards.length }})
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          <div
            v-for="card in group.cards"
            :key="`${card.setCode}-${card.number}`"
            class="p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div class="flex items-center md:gap-3 gap-1">
              <button
                @click="decrementCard(card.cardName, card.setCode)"
                :disabled="!selectedCardsBySet.get(card.setCode)?.has(card.cardName)"
                class="md:px-3 md:py-1.5 px-1 py-1 bg-xanthous-500/20 hover:bg-xanthous-500/30 rounded-lg text-sm font-mono transition-colors btn-primary"
                :class="{
                  'opacity-50 cursor-not-allowed': !selectedCardsBySet.get(card.setCode)?.has(card.cardName)
                }"
              >
                -1
              </button>
              <button
                @click="incrementCard(card.cardName, card.setCode)"
                class="md:px-3 md:py-1.5 px-1 py-1 bg-xanthous-500/20 hover:bg-xanthous-500/30 rounded-lg text-sm font-mono transition-colors btn-primary"
                :class="{
                  'opacity-50 cursor-not-allowed': 
                    deckStore.getCardCount(card.cardName) >= deckStore.getRequiredCount(card.cardName)
                }"
                :disabled="deckStore.getCardCount(card.cardName) >= deckStore.getRequiredCount(card.cardName)"
              >
                +1
              </button>
              {{ card.cardName }}
              <div
                v-if="deckStore.cardPrintings.find(p => p.cardName === card.cardName )?.manaCost"
                class="text-sm text-peach-yellow-300 font-mono grow text-right"
              >
                <ManaSymbols 
                  :text="deckStore.cardPrintings.find(p => p.cardName === card.cardName )?.manaCost || ''"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <SetTypeModal
      v-model:show="showSetTypeModal"
      v-model:selectedTypes="deckStore.selectedSetTypes"
      v-model:selectedSets="deckStore.selectedSets"
    />
</template>