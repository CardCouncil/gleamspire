<script setup lang="ts">
import { ref } from 'vue'
import { useDeckStore } from '../stores/deck'
import SetTypeModal from '../components/SetTypeModal.vue'
import logo from '../assets/logo.png'

const deckStore = useDeckStore()
const newDeckList = ref('')
const showSetTypeModal = ref(false)

async function handleSubmit() {
  if (newDeckList.value.trim()) {
    await deckStore.addDeckList(newDeckList.value)
    newDeckList.value = ''
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-8">
    <img :src="logo" alt="Gleamspire Logo" class="w-48 h-auto mx-auto mb-4 rounded-full">
    <h1 class="text-4xl font-bold text-center mb-8">Gleamspire</h1>
    
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
        @click="deckStore.clearAll" 
        class="px-4 py-2 mx-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
      >
        Clear All
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

    <div v-if="deckStore.groupedBySet.length" class="mt-8">
      <h2 class="text-2xl font-semibold mb-6">Card Printings</h2>
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
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="deckStore.checkedCards.has(card.cardName)"
                @change="deckStore.toggleCard(card.setCode, card.number)"
                class="w-4 h-4 text-blue-600"
              >
              {{ card.cardName }}
            </label>
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