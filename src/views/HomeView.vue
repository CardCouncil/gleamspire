<script setup lang="ts">
import { ref } from 'vue'
import logo from '../assets/logo.png'
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
async function handleSubmit() {
  if (newDeckList.value.trim()) {
    await deckStore.addDeckList(newDeckList.value)
    newDeckList.value = ''
  }
}

onMounted(async () => {
  await deckStore.initializeSetMetadata()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-8 space-y-8">
    <img :src="logo" alt="cardboard tutor logo" class="w-48 h-auto mx-auto mb-4">
    <h1 class="text-6xl header-font text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
      Cardboard Tutor
    </h1>
    
    <div class="glass-card p-8 rounded-xl text-center space-y-4">
      <textarea
        v-model="newDeckList"
        placeholder="Paste your deck list here (one card per line)"
        rows="10"
        class="w-full p-4 mb-4 font-mono input-field"
      ></textarea>
      <div class="flex justify-center gap-4">
        <button 
          @click="handleSubmit" 
          :disabled="deckStore.isLoading"
          class="btn-primary"
        >
          {{ deckStore.isLoading ? 'Processing...' : 'Add Deck List' }}
        </button>
        <button 
          @click="showSetTypeModal = true" 
          class="btn-secondary"
        >
          Filter Set
        </button>
      </div>
    </div>

    <div v-if="deckStore.error" class="p-4 mb-4 text-red-700 bg-red-100 border border-red-300 rounded-lg">
      {{ deckStore.error }}
    </div>

    <div v-if="deckListEntries.length > 0" class="space-y-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl header-font bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
          Current Deck List
        </h2>
        <label class="flex items-center gap-2 justify-end">
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
      <div class="glass-card p-6 rounded-xl">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          <div
            v-for="[cardName, quantity] in deckListEntries"
            :key="cardName"
            class="p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div class="flex items-center gap-2">
              <span 
                class=" font-mono text-sm"
                :class="deckStore.getCardCount(cardName) >= quantity ? 'text-ivory/50' : 'text-peach-yellow-300'"
              >
                ({{ deckStore.getCardCount(cardName) }}/{{ quantity }})
              </span>
              <span 
                class="flex items-center gap-2"
                :class="{ 'line-through text-ivory/50': deckStore.getCardCount(cardName) >= quantity }"
              >
                {{ cardName }}{{ ' ' }}
                <template v-if="deckStore.cardPrintings && deckStore.cardPrintings.length > 0">
                  <span
                    v-if="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost"
                    class="text-sm text-peach-yellow-300 font-mono"
                  >
                    <ManaSymbols 
                      :text="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost || ''"
                    />
                  </span>
                </template>
              </span>
              <div 
                class="ml-auto font-mono text-sm text-white"
              >
                <button
                  @click="deckStore.decrementCard(cardName)"
                  :disabled="deckStore.getCardCount(cardName) <= 0"
                  class="px-3 py-1.5 bg-xanthous-500/20 hover:bg-xanthous-500/30 rounded-lg text-sm font-mono transition-colors"
                  :class="{
                    'opacity-50 cursor-not-allowed': deckStore.getCardCount(cardName) <= 0
                  }"
                >
                  -1
                </button>
            </div>
          </div>
        </div>
      </div>
        <div class="mt-6 flex justify-center">
          <button
            @click="exportRemainingCards"
            class="btn-secondary"
          >
            Export
          </button>
        </div>
      </div>
    </div>

    <div v-if="deckStore.groupedBySet.length > 0" class="space-y-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl header-font bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
          Card Printings
        </h2>
        <label class="flex items-center gap-2 justify-end">
          <span class="text-sm font-medium">Order sets by:</span>
          <select
            v-model="deckStore.setOrderBy"
            class="px-3 py-1.5 rounded-lg text-sm input-field min-w-[120px]"
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
        v-for="group in deckStore.groupedBySet" 
        :key="group.setName" 
        class="glass-card p-6 rounded-xl mb-6"
      >
        <h3 class="text-xl font-medium mb-4">
          <img 
            :src="group.symbolUrl" 
            :alt="`${group.setName} symbol`" 
            class="w-6 h-6 inline-block mr-2 invert"
          >
          {{ group.setName }} ({{ group.cards.length }} cards)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          <div
            v-for="card in group.cards"
            :key="`${card.setCode}-${card.number}`"
            class="p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div class="flex items-center gap-3">
              <button
                @click="deckStore.incrementCard(card.cardName)"
                class="px-3 py-1.5 bg-xanthous-500/20 hover:bg-xanthous-500/30 rounded-lg text-sm font-mono transition-colors"
                :class="{
                  'opacity-50 cursor-not-allowed': 
                    deckStore.getCardCount(card.cardName) >= deckStore.getRequiredCount(card.cardName)
                }"
                :disabled="deckStore.getCardCount(card.cardName) >= deckStore.getRequiredCount(card.cardName)"
              >
                +1
              </button>
              {{ card.cardName }}
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
  </div>
</template>