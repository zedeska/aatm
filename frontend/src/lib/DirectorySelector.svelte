<script lang="ts">
    import { SelectDirectory } from '../../wailsjs/go/main/App';
    import { appState } from './appState.svelte';
    import Icon from '@iconify/svelte';

    let { onrefresh } = $props<{ onrefresh?: () => void }>();

    async function handleSelect() {
        try {
        const result = await SelectDirectory();
        if (result) {
            appState.setPath(result);
        }
        } catch (err) {
        console.error('Failed to select directory:', err);
        }
    }

    function handleRefresh(e: MouseEvent) {
        e.stopPropagation();
        if (onrefresh) onrefresh();
    }
</script>
<div class="cursor-pointer flex flex-row items-center gap-4 p-4 border border-zinc-700 rounded bg-zinc-900 max-w-3xl" onclick={handleSelect}>
    <Icon icon="material-symbols:folder-outline" width="24" height="24" />
    <div class="flex flex-col flex-1">
        <h2 class="text-lg font-semibold">Selected Directory</h2>
        <h4>{appState.selectedPath ? appState.selectedPath : "No directory selected"}</h4>
    </div>
    <button onclick={handleRefresh} class="cursor-pointer p-2 hover:bg-zinc-700 rounded-full transition-colors text-gray-400 hover:text-white" title="Refresh">
        <Icon icon="mdi:refresh" width="24" height="24" />
    </button>
</div>