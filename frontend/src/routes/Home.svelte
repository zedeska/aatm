<script lang="ts">
    import { appState } from "../lib/appState.svelte";
    import DirectorySelector from '../lib/DirectorySelector.svelte';
    import FileList from '../lib/FileList.svelte';

    let fileList: FileList;

    function refreshList() {
        fileList?.refresh();
    }
</script>

<div class="p-6 items-center">
    <div class="mb-6">
        <h2 class="text-xl font-bold text-purple-400 mb-2">Current Directory</h2>
        <DirectorySelector onrefresh={refreshList} />
    </div>

    <FileList bind:this={fileList} currentPath={appState.selectedPath} />
</div>


