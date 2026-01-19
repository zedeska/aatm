<script lang="ts">
    import Icon from '@iconify/svelte';
    import { ListDirectory, MarkProcessed } from '../../wailsjs/go/main/App';
    import type { main } from '../../wailsjs/go/models';
    import { appState } from './appState.svelte';
    import { navigate, p } from '../router';

    let { currentPath } = $props<{ currentPath: string }>();

    let files: main.FileInfo[] = $state([]);
    // Removed local state, using appState
    // let showProcessed = $state(true);
    // let showNotProcessed = $state(true);

    let filteredFiles = $derived(files.filter(f => {
        if (f.isProcessed && !appState.showProcessed) return false;
        if (!f.isProcessed && !appState.showNotProcessed) return false;
        return true;
    }));

    $effect(() => {
        if (currentPath) {
            loadFiles(currentPath);
        }
    });

    async function handleMarkProcessed(path: string) {
        try {
            await MarkProcessed(path);
            refresh();
        } catch (e) {
            console.error(e);
        }
    }

    function handleProcess(path: string, isDir: boolean) {
        appState.processingPath = path;
        appState.processingIsDir = isDir;
        navigate('/process');
    }

    async function loadFiles(path: string) {
        try {
            files = await ListDirectory(path);
            // Sort: Directories first, then files
            files.sort((a, b) => {
                if (a.isDir === b.isDir) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDir ? -1 : 1;
            });
        } catch (err) {
            console.error(err);
        }
    }

    export function refresh() {
        if (currentPath) loadFiles(currentPath);
    }

    function formatSize(bytes: number) {
        if (bytes === 0) return '-';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getFullPath(fileName: string) {
        const sep = currentPath.includes('\\') ? '\\' : '/';
        return currentPath.endsWith(sep) ? currentPath + fileName : currentPath + sep + fileName;
    }
</script>

<div class="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900">
    <table class="w-full text-left text-sm text-gray-400">
        <thead class="bg-zinc-800 text-xs uppercase text-gray-400">
            <tr>
                <th scope="col" class="px-6 py-3">
                    <div class="flex items-center gap-4">
                        <span>Type</span>
                        <div class="flex items-center gap-3 border-l border-zinc-700 pl-4 ml-2">
                            <button 
                                onclick={() => { appState.showProcessed = !appState.showProcessed; appState.save(); }}
                                class="flex items-center gap-1.5 cursor-pointer transition-colors outline-none {appState.showProcessed ? 'text-purple-400' : 'text-zinc-500 hover:text-purple-400'}"
                                title="Toggle Processed Files"
                            >
                                <Icon icon={appState.showProcessed ? "mdi:checkbox-marked-circle" : "mdi:checkbox-blank-circle-outline"} />
                                <span class="text-[10px] font-bold">PROCESSED</span>
                            </button>
                            <button 
                                onclick={() => { appState.showNotProcessed = !appState.showNotProcessed; appState.save(); }}
                                class="flex items-center gap-1.5 cursor-pointer transition-colors outline-none {appState.showNotProcessed ? 'text-purple-400' : 'text-zinc-500 hover:text-purple-400'}"
                                title="Toggle Unprocessed Files"
                            >
                                <Icon icon={appState.showNotProcessed ? "mdi:checkbox-marked-circle" : "mdi:checkbox-blank-circle-outline"} />
                                <span class="text-[10px] font-bold">UNPROCESSED</span>
                            </button>
                        </div>
                    </div>
                </th>
                <th scope="col" class="px-6 py-3 w-full">Name</th>
                <th scope="col" class="px-6 py-3 whitespace-nowrap">Size</th>
                <th scope="col" class="px-6 py-3 text-right">Actions</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800">
            {#each filteredFiles as file}
                <tr class="hover:bg-zinc-800/50 transition-colors">
                    <td class="px-6 py-4 flex items-center gap-3">
                        {#if file.isDir}
                            <Icon icon="mdi:folder" class="text-2xl text-purple-500" />
                        {:else}
                            <Icon icon="mdi:video" class="text-2xl text-gray-500" />
                        {/if}
                        
                        {#if file.isProcessed}
                            <span class="text-[10px] uppercase font-bold tracking-wider text-green-500 bg-green-500/10 px-2 py-1 rounded-sm border border-green-500/20">Processed</span>
                        {:else}
                             <span class="text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-800 px-2 py-1 rounded-sm border border-zinc-700">Not Processed</span>
                        {/if}
                    </td>
                    <td class="px-6 py-4 font-medium text-gray-200">
                        {file.name}
                    </td>
                    <td class="px-6 py-4 font-mono text-xs">
                        {file.isDir ? '-' : formatSize(file.size)}
                    <td class="px-6 py-4 text-right whitespace-nowrap space-x-2">
                        {#if !file.isProcessed}
                            <button 
                                onclick={() => handleProcess(getFullPath(file.name), file.isDir)}
                                class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 bg-zinc-800"
                            >
                                Process
                            </button>
                            <button 
                                onclick={() => handleMarkProcessed(getFullPath(file.name))}
                                class="inline-flex items-center px-3 py-1.5 border border-zinc-600 text-xs font-medium rounded text-gray-300 bg-transparent hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500"
                            >
                                Mark Done
                            </button>
                        {:else}
                            <button 
                                onclick={() => handleProcess(getFullPath(file.name), file.isDir)}
                                class="inline-flex items-center px-3 py-1.5 border border-zinc-600 text-xs font-medium rounded text-gray-300 bg-transparent hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 transition-colors"
                            >
                                <Icon icon="mdi:refresh" class="mr-1.5 md:text-lg" />
                                Re-process
                            </button>
                        {/if}
                    </td>
                </tr>
            {/each}
            {#if filteredFiles.length === 0}
                 <tr>
                    <td colspan="3" class="px-6 py-8 text-center text-gray-500 italic">
                        {#if files.length > 0}
                            No files match filter
                        {:else}
                            Empty directory
                        {/if}
                    </td>
                </tr>
            {/if}
        </tbody>
    </table>
</div>
