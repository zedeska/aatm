<script lang="ts">
	import { Router } from 'sv-router';
	import './router.ts';
    import { appState } from './lib/appState.svelte';

  import Nav from './lib/Nav.svelte';

  $effect(() => {
     appState.load();
  });
</script>



<main class="h-screen w-screen">

  <div class="fixed top-0 left-0 w-full">
    <Nav />
  </div>
  

  <div class="flex flex-col justify-center items-center w-full h-full relative">
    <Router />
  </div>
  
</main>