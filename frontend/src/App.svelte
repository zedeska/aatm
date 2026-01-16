<script lang="ts">
	import { Router } from 'sv-router';
	import './router.ts';
    import { appState } from './lib/appState.svelte';

  import Nav from './lib/Nav.svelte';

  $effect(() => {
     appState.load();
  });
</script>



<main class="h-screen w-screen flex flex-col overflow-hidden">

  <div class="w-full shrink-0 z-50">
    <Nav />
  </div>
  

  <div class="flex-1 w-full relative overflow-y-auto">
    <Router />
  </div>
  
</main>