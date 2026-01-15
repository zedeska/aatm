<script lang="ts">

    import { p, navigate, isActive, route } from '../router.ts';

    import Icon from '@iconify/svelte';

    let isSettingsOpen = false;

    function handleOutsideClick() {
        isSettingsOpen = false;
    }

    function toggleSettings(e: MouseEvent) {
        e.stopPropagation();
        isSettingsOpen = !isSettingsOpen;
    }

</script>

<svelte:window onclick={handleOutsideClick} />

<nav class="w-full">
    <ul class="flex items-center justify-between gap-6 p-4">
        <li>
            <a href={p('/')} class="flex items-center justify-center text-gray-300 hover:text-purple-400 font-medium {isActive('/') ? 'text-purple-400' : ''}"><Icon icon="mdi:home" height="24" /></a>
        </li>
        <li class="relative flex items-center">
            <button 
                onclick={toggleSettings} 
                class="flex items-center justify-center cursor-pointer text-gray-300 hover:text-purple-400 font-medium {isActive('/settings') ? 'text-purple-400' : ''}"
            >
                <Icon icon="mdi:cog" height="24" />
            </button>
            {#if isSettingsOpen}

            <div class="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-50">
                <a href={p('/settings')} class="block px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-purple-400">Settings</a>
                <a href={p('/about')} class="block px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-purple-400">About</a>
            </div>
            {/if}
        </li>
    </ul>
</nav>