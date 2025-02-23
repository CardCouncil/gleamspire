<script setup lang="ts"></script>

<template>
  <header>
    <nav>
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </nav>
  </header>

  <router-view />
</template>

<style scoped>
nav {
  padding: 2rem;
  text-align: center;
}

nav a {
  margin: 0 1rem;
  font-weight: bold;
}

nav a.router-link-active {
  color: #42b883;
}
</style>
