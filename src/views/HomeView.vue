<script setup lang="ts">
import { ref } from 'vue'
import { useDeckStore } from '../stores/deck'
import SetTypeModal from '../components/SetTypeModal.vue'
import ManaSymbols from '../components/ManaSymbols.vue'
import logo from '../assets/logo.png'
import { computed } from 'vue'

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

</script>

<template>
  <div class="max-w-4xl mx-auto p-8">
    <img :src="logo" alt="cardboard tutor logo" class="w-48 h-auto mx-auto mb-4">
    <h1 class="text-4xl font-bold text-center mb-8">Cardboard Tutor</h1>
    
    <div class="mb-8 text-center">
      <textarea
        v-model="newDeckList"
        placeholder="Paste your deck list here (one card per line)"
        rows="10"
        class="w-full p-4 mb-4 border rounded-lg font-mono bg-gray-50 dark:bg-gray-800"
      ></textarea>
      <button 
        @click="handleSubmit" 
        :disabled="deckStore.isLoading"
        class="px-4 py-2 mx-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {{ deckStore.isLoading ? 'Processing...' : 'Add Deck List' }}
      </button>
      <button 
        @click="showSetTypeModal = true" 
        class="px-4 py-2 mx-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
      >
        Filter Set Types
      </button>
    </div>

    <div v-if="deckStore.error" class="p-4 mb-4 text-red-700 bg-red-100 border border-red-300 rounded-lg">
      {{ deckStore.error }}
    </div>

    <div v-if="deckListEntries.length > 0" class="mt-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-semibold">Current Deck List</h2>
        <label class="flex items-center gap-2 justify-end">
          <span class="text-sm font-medium">Sort by:</span>
          <select
            v-model="deckStore.cardSortBy"
            class="px-3 py-1.5 bg-white dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[120px]"
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
      <div class="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="[cardName, quantity] in deckListEntries"
            :key="cardName"
            class="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono">{{ quantity }}x</span>
              <span class="flex items-center gap-2">
                {{ cardName }}{{ ' ' }}
                <template v-if="deckStore.cardPrintings && deckStore.cardPrintings.length > 0">
                  <span
                    v-if="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost"
                    class="text-sm text-gray-500 font-mono"
                  >
                    <ManaSymbols 
                      :text="deckStore.cardPrintings.find(p => p.cardName === cardName)?.manaCost || ''"
                    />
                  </span>
                </template>
              </span>
              <span class="ml-auto font-mono text-sm text-gray-500">
                ({{ deckStore.getCardCount(cardName) }}/{{ quantity }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deckStore.groupedBySet.length > 0" class="mt-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-semibold">Card Printings</h2>
        <label class="flex items-center gap-2 justify-end">
          <span class="text-sm font-medium">Order sets by:</span>
          <select
            v-model="deckStore.setOrderBy"
            class="px-3 py-1.5 bg-white dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[120px]"
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
        class="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm"
      >
        <h3 class="text-xl font-medium mb-4">
          <img 
            :src="group.symbolUrl" 
            :alt="`${group.setName} symbol`" 
            class="w-6 h-6 inline-block mr-2 dark:invert"
          >
          {{ group.setName }} ({{ group.cards.length }} cards)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="card in group.cards"
            :key="`${card.setCode}-${card.number}`"
            class="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <div class="flex items-center gap-3">
              <button
                @click="deckStore.incrementCard(card.cardName)"
                class="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm font-mono"
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
    />
  </div>
</template>