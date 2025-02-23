<script setup lang="ts">
const props = defineProps<{
  show: boolean
  selectedTypes: Set<string>
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:selectedTypes', value: Set<string>): void
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

function toggleType(type: string) {
  const newTypes = new Set(props.selectedTypes)
  if (newTypes.has(type)) {
    newTypes.delete(type)
  } else {
    newTypes.add(type)
  }
  emit('update:selectedTypes', newTypes)
}

function close() {
  emit('update:show', false)
}
</script>

<template>
  <div 
    v-if="show" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
    @click="close"
  >
    <div 
      class="bg-white dark:bg-gray-800 p-8 rounded-lg max-w-2xl w-11/12 max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <h2 class="text-2xl font-semibold mb-6">Filter Set Types</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label 
          v-for="type in setTypes" 
          :key="type" 
          class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
        >
          <input
            type="checkbox"
            :checked="selectedTypes.has(type)"
            @change="toggleType(type)"
            class="w-4 h-4 text-blue-600"
          >
          {{ type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
        </label>
      </div>
      <button 
        @click="close" 
        class="w-full mt-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        Close
      </button>
    </div>
  </div>
</template>