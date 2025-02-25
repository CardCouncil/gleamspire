<script setup lang="ts">
import { useDeckStore } from '../stores/deck'
import { computed, watch } from 'vue'

const props = defineProps<{
  show: boolean
  selectedTypes: Set<string>
  selectedSets: Set<string>
}>()

const deckStore = useDeckStore()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:selectedTypes', value: Set<string>): void
  (e: 'update:selectedSets', value: Set<string>): void
}>()

const setTypes = [
  'expansion',
  'core',
  'masters',
  'commander',
  'draft_innovation',
  'funny',
  'duel_deck',
  'premium_deck',
  'from_the_vault',
  'spellbook',
  'archenemy',
  'planechase',
  'box',
  'starter',
  'token',
  'memorabilia',
  'alchemy'
]

const availableSets = computed(() => {
  const sets = new Map()
  
  // If we have card printings, use those
  if (deckStore.cardPrintings && deckStore.cardPrintings.length > 0) {
    deckStore.cardPrintings.forEach(card => {
      if (props.selectedTypes.has(card.setType)) {
        const metadata = deckStore.setMetadata.get(card.setCode)
        sets.set(card.setCode, {
          name: card.setName,
          code: card.setCode,
          type: card.setType,
          symbolUrl: metadata?.icon_svg_uri || ''
        })
      }
    })
  } else {
    // Otherwise, use the set metadata directly
    deckStore.setMetadata.forEach((metadata, code) => {
      sets.set(code, {
        name: metadata.name,
        code: code,
        type: 'expansion', // Default to expansion for initial load
        symbolUrl: metadata.icon_svg_uri || ''
      })
    })
  }
  
  return Array.from(sets.values()).sort((a, b) => {
    // Sort by set type first, then by name
    const typeCompare = a.type.localeCompare(b.type)
    return typeCompare !== 0 ? typeCompare : a.name.localeCompare(b.name)
  })
})

// Watch for changes in available sets and automatically select all new sets
watch(availableSets, (newSets) => {
  const newSelectedSets = new Set(props.selectedSets)
  newSets.forEach(set => {
    newSelectedSets.add(set.code)
  })
  emit('update:selectedSets', newSelectedSets)
}, { immediate: true })

function toggleType(type: string) {
  const newTypes = new Set(props.selectedTypes)
  if (newTypes.has(type)) {
    newTypes.delete(type)
  } else {
    newTypes.add(type)
  }
  emit('update:selectedTypes', newTypes)
}

function toggleSet(code: string) {
  const newSets = new Set(props.selectedSets)
  if (newSets.has(code)) {
    newSets.delete(code)
  } else {
    newSets.add(code)
  }
  emit('update:selectedSets', newSets)
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <div 
    v-if="show" 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
    @click="close"
  >
    <div 
      class="glass-card p-8 rounded-xl max-w-6xl w-11/12 max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
            Filter Sets
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label 
              v-for="type in setTypes" 
              :key="type" 
              class="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-3 rounded-lg transition-colors"
            >
              <input
                type="checkbox"
                :checked="selectedTypes.has(type)"
                @change="toggleType(type)"
                class="w-4 h-4 text-xanthous-500 bg-ivory/10 border-peach-yellow-300/20 rounded"
              >
              {{ type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
            </label>
          </div>
        </div>
        
        <div>
          <h3 class="text-xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-xanthous-400 to-peach-yellow-400">
            Available Sets
          </h3>
          <p class="text-sm text-ivory/60 mb-4">Filter by set type above to show relevant sets</p>
          
          <div class="grid grid-cols-1 md:grid-cols-2  lg:grid-cols-3 gap-4">
            <label 
              v-for="set in availableSets" 
              :key="set.code" 
              class="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-3 rounded-lg transition-colors"
            >
              <input
                type="checkbox"
                :checked="selectedSets.has(set.code)"
                @change="toggleSet(set.code)"
                class="w-4 h-4 text-xanthous-500 bg-ivory/10 border-peach-yellow-300/20 rounded"
              >
              <img 
                v-if="set.symbolUrl"
                :src="set.symbolUrl"
                :alt="`${set.name} symbol`"
                class="w-4 h-4 invert"
              >
              {{ set.name }}
            </label>
          </div>
        </div>
        
        <button 
          @click="close" 
          class="w-full btn-primary"
          >
          Close
        </button>
      </div>
    </div>
  </div>
</template>