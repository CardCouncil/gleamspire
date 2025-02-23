<script setup lang="ts">
import { ref } from 'vue'
import { useDeckStore } from '../stores/deck'
import SetTypeModal from '../components/SetTypeModal.vue'
import logo from '../assets/logo.png'
import { computed } from 'vue'

const deckStore = useDeckStore()
const newDeckList = ref('')
const showSetTypeModal = ref(false)
const orderOptions = [
  { value: 'releaseDate', label: 'Release Date (Newest First)' },
  { value: 'cardCount', label: 'Number of Cards (Most First)' }
] as const

const deckListEntries = computed(() => 
  Array.from(deckStore.currentDeckList.entries())
    .sort(([a], [b]) => a.localeCompare(b))
)

async function handleSubmit() {
  if (newDeckList.value.trim()) {
    await deckStore.addDeckList(newDeckList.value)
    newDeckList.value = ''
  }
}

async function loadPrintings() {
  await deckStore.loadPrintings()
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
      <h2 class="text-2xl font-semibold mb-6">Current Deck List</h2>
      <div class="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="[cardName, quantity] in deckListEntries"
            :key="cardName"
            class="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono">{{ quantity }}x</span>
              <span>{{ cardName }}</span>
              <span class="ml-auto font-mono text-sm text-gray-500">
                ({{ deckStore.getCardCount(cardName) }}/{{ quantity }})
              </span>
            </div>
          </div>
        </div>
        <div class="mt-6 text-center">
          <button 
            @click="loadPrintings" 
            :disabled="deckStore.isLoading"
            class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {{ deckStore.isLoading ? 'Loading Printings...' : 'Load Card Printings' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="deckStore.groupedBySet.length > 0" class="mt-8">
      <h2 class="text-2xl font-semibold mb-6">Card Printings</h2>
      <div class="mb-4">
        <label class="flex items-center gap-2 justify-end">
          <span class="text-sm font-medium">Order sets by:</span>
          <select
            v-model="deckStore.setOrderBy"
            class="px-3 py-1.5 bg-white dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
            class="w-6 h-6 inline-block mr-2"
          >
          {{ group.setName }} ({{ group.cards.length }} cards)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                [+1]
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