<script lang="ts">
    import { appState } from "../lib/appState.svelte";
    import { ListDirectory, MarkProcessed, GetMediaInfo, CreateTorrent, OpenFileLocation, SaveNfo, UploadToQBittorrent, RemoveFromQBittorrent, UploadToLaCale, DeleteFile, GetDirectorySize } from "../../wailsjs/go/main/App";
    import { navigate } from "../router";
    import { parseReleaseName, type ReleaseInfo } from "../lib/parser";
    import { generatePresentation } from "../lib/presentation";
    import Icon from '@iconify/svelte';

    let step: 'select-type' | 'process' = $state('select-type');
    let workingPath = $state("");
    let mediaType: 'movie' | 'episode' | 'season' = $state('movie');
    let analyzingFile = $state("");
    let isGeneratingNfo = $state(false);
    let isCreatingTorrent = $state(false);    
    let isFullAutoRunning = $state(false);

    let isInputDirectory = $derived(appState.processingIsDir);

    // Completion State
    let isTmdbDone = $derived(!!selectedTmdbItem);
    let isNameDone = $derived(!!torrentName && torrentName.length > 0);
    // We consider NFO done if content exists (generated or typed)
    let isNfoDone = $derived(!!nfoContent && nfoContent.length > 0);
    let isTorrentDone = $derived(!!generatedTorrentPath);
    let isAnalysisDone = $derived(!!releaseInfo.title);
    
    let allStepsDone = $derived(isTmdbDone && isNameDone && isNfoDone && isTorrentDone);

    // Process Form Data
    let tmdbId = $state("");
    let torrentName = $state("");
    let nfoContent = $state(""); 
    let generatedTorrentPath = $state("");
    let generatedNfoPath = $state("");
    let hasAutoSearched = $state(false);
    let tmdbGenres: string[] = $state([]);
    
    // Release Info Parsing
    let releaseInfo: ReleaseInfo = $state({});
    
    // Effect 1: Parse Release Info based on path/content/genres
    $effect(() => {
        if (workingPath) {
             const namePart = workingPath.split(/[/\\]/).pop() || "";
             // We do NOT read releaseInfo fields here to avoid cycles
             const parsed = parseReleaseName(namePart, nfoContent);
             
             // Restore genres
             if (tmdbGenres.length > 0) {
                 parsed.genres = tmdbGenres;
             }

             releaseInfo = parsed;

             // Auto-fill torrent name if empty and we have a valid title/year
             // Using 'untrack' or just checking if torrentName is empty (which is state) is fine
             // But reading torrentName makes this effect depend on it. 
             // Ideally we only want to set it once.
             if (!torrentName) {
                 torrentName = namePart;
             }
        }
    });

    // Effect 2: Auto-Search TMDB when title appears
    $effect(() => {
        if (workingPath && !hasAutoSearched && !tmdbQuery && releaseInfo.title) {
            // This effect triggers when releaseInfo changes. 
            // It does NOT write to releaseInfo (except indirectly via search results later).
            
            let query = releaseInfo.title;
            if (releaseInfo.year) {
                query = `${releaseInfo.title} ${releaseInfo.year || ''}`.trim();
            }
            
            // To prevent cycle, we update the state outside the synchronous tracking context or ensure conditions stop it
            tmdbQuery = query;
            searchTmdb();
            hasAutoSearched = true;
        }
    });

    // TMDB Search State
    let tmdbQuery = $state("");
    let tmdbResults: any[] = $state([]);
    let tmdbLoading = $state(false);
    let selectedTmdbItem: any = $state(null);

    const TMDB_API_KEY = "49d8d37e45764e7c6794ed7dd2d896d4";

    async function runFullAuto(item: any) {
        if (isFullAutoRunning || isUploading) return;
        isFullAutoRunning = true;
        
        try {
            // 1. Select TMDB Item
            await selectTmdbItem(item);
            
            // 2. Generate NFO
            await generateNfo();
            
            // 3. Create Torrent
            await handleCreateTorrent();
            
            // 4. Mark Done (Uploads and finishes)
            await handleMarkDone();
        } catch(e) {
            console.error("Full Auto Failed:", e);
        } finally {
            isFullAutoRunning = false;
        }
    }

    async function searchTmdb() {
        if (!tmdbQuery) return;
        tmdbLoading = true;
        tmdbResults = [];
        selectedTmdbItem = null;

        const type = mediaType === 'movie' ? 'movie' : 'tv';
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(tmdbQuery)}`);
            const data = await res.json();
            tmdbResults = data.results || [];

            if (appState.isFullAuto && tmdbResults.length > 0) {
                await runFullAuto(tmdbResults[0]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            tmdbLoading = false;
        }
    }

    async function selectTmdbItem(item: any) {
        selectedTmdbItem = item;
        tmdbId = item.id.toString();
        tmdbResults = []; 
        tmdbQuery = ""; 

        // Fetch details for genres
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        try {
             const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
             const details = await res.json();
             if (details.genres) {
                 tmdbGenres = details.genres.map((g: any) => g.name);
                 releaseInfo.genres = tmdbGenres;
             }
        } catch (e) {
            console.error("Failed to fetch TMDB details:", e);
        }
    }

    async function generateNfo() {
        if (!analyzingFile) return;
        isGeneratingNfo = true;
        generatedNfoPath = "";
        try {
            const output = await GetMediaInfo(analyzingFile);
            nfoContent = output;
            
            // Auto save
            if (workingPath) {
                 generatedNfoPath = await SaveNfo(workingPath, nfoContent);
            }
        } catch (e) {
            console.error(e);
            alert("Error generating NFO: " + e);
        } finally {
            isGeneratingNfo = false;
        }
    }

    async function handleTypeSelection(type: 'movie' | 'episode' | 'season') {
        mediaType = type;
        const path = appState.processingPath;
        const isDirectory = appState.processingIsDir;

        workingPath = path;
        analyzingFile = "";

        if (isDirectory) {
            try {
                const files = await ListDirectory(path);
                // Filter for video files
                const videoFiles = files.filter(f => !f.isDir); // ListDirectory already filters for mkv/mp4
                
                if (videoFiles.length > 0) {
                    // Sort alphabetically to handle series consistently
                    videoFiles.sort((a, b) => a.name.localeCompare(b.name));
                    
                    const sep = path.includes('\\') ? '\\' : '/';

                    if (type === 'movie' || type === 'season') {
                        // For movie in folder or season pack, pick first file for analysis
                        analyzingFile = path + sep + videoFiles[0].name;
                        // workingPath stays as folder
                    } else if (type === 'episode') {
                        // Single episode in a folder? Usually means user selected the folder.
                        // We'll treat it like season pack for now or maybe we should ask user to select file?
                        // Assuming folder = pack for now, but user said "separate single episode".
                        // If user selects "Single Episode" on a FOLDER, maybe we default to first file too?
                         analyzingFile = path + sep + videoFiles[0].name;
                    }
                }
            } catch (e) {
                console.error("Error checking folder", e);
            }
        } else {
            // It's a file
            analyzingFile = path;
            // If it's a file, workingPath should probably be the file?
            // Existing logic:
            // Movie in folder -> workingPath = file (Wait, previous code said `workingPath = path + '\\' + video.name`)
            // Actually, for Movie in folder, usually we want to process the cleanup on the folder or the file?
            // The prompt says "for serie we only do the 1st file if its multiple episode".
            // Previous code:
            // Movie + isDirectory -> workingPath = file path.
            // Series -> workingPath = path (folder or file).
            
            // Let's stick to:
            // AnalyzingFile is ALWAYS the file path used for MediaInfo.
            // WorkingPath is the entity we are "processing".
        }
        
        // Finalize Working Path Logic
        if (type === 'movie') {
             if (isDirectory && analyzingFile) {
                 workingPath = analyzingFile; // Treat movie as single file even if inside folder? Or folder?
                 // Let's stick to previous logic: Movie -> use file path if found.
             }
        }
        // Series/Season -> workingPath is expected to be the folder if dir, or file if file.

        const namePart = workingPath.split(/[/\\]/).pop() || "";
        torrentName = namePart;

        // Reset Search State
        tmdbQuery = "";
        tmdbResults = [];
        selectedTmdbItem = null;
        hasAutoSearched = false;
        
        step = 'process';
    }

    async function handleCreateTorrent() {
        if (!workingPath) return;
        isCreatingTorrent = true;
        try {
            // Split trackers by newline
            const trackers = appState.torrentTrackers.split('\n').map(t => t.trim()).filter(t => t.length > 0);
            
            // Create torrent
            const createdPath = await CreateTorrent(workingPath, trackers, "Created by AATM", appState.isPrivateTorrent);
            generatedTorrentPath = createdPath;
        } catch (e) {
            console.error(e);
            alert("Error creating torrent: " + e);
        } finally {
            isCreatingTorrent = false;
        }
    }

    let isUploading = $state(false);
    
    async function cleanupFiles() {
        if (generatedTorrentPath) {
            try {
                await DeleteFile(generatedTorrentPath);
            } catch (e) {
                console.error("Failed to delete torrent:", e);
            }
        }
        if (generatedNfoPath) {
            try {
                await DeleteFile(generatedNfoPath);
            } catch (e) {
                console.error("Failed to delete NFO:", e);
            }
        }
        generatedTorrentPath = "";
        generatedNfoPath = "";
    }

    async function handleCancel() {
        await cleanupFiles();
        navigate('/');
    }

    async function handleMarkDone() {
        if (!workingPath) return;
        if (isUploading) return;
        isUploading = true;

        try {
            // Ensure NFO is saved if we have content but no file
            if (!generatedNfoPath && nfoContent) {
                try {
                    generatedNfoPath = await SaveNfo(workingPath, nfoContent);
                } catch (e) {
                    console.warn("Could not auto-save NFO before upload:", e);
                    // Continue, upload might fail or we might skip if logic allows
                }
            }

            // 1. Upload to qBittorrent if configured
            if (appState.qbitUrl) {
                try {
                    await UploadToQBittorrent(generatedTorrentPath, appState.qbitUrl, appState.qbitUsername, appState.qbitPassword);
                } catch (e) {
                    console.error("qBittorrent error:", e);
                    if (!confirm(`qBittorrent upload failed: ${e}\n\nContinue with La Cale upload?`)) {
                        isUploading = false;
                        await cleanupFiles();
                        return;
                    }
                }
            }

            // 2. Upload to La Cale
            if (appState.passkey && appState.laCaleEmail) {
                try {
                    let totalSize = undefined;
                    if (isInputDirectory && mediaType === 'season') {
                        try {
                            totalSize = await GetDirectorySize(workingPath);
                        } catch (e) {
                            console.warn("Failed to get total size:", e);
                        }
                    }

                    const description = await generatePresentation({
                        releaseInfo,
                        tmdbId,
                        mediaType,
                        nfoContent,
                        totalSize
                    });

                    await UploadToLaCale(
                        generatedTorrentPath, 
                        generatedNfoPath, 
                        torrentName, // Title using the torrent name user confirmed
                        description,
                        tmdbId, 
                        mediaType, 
                        releaseInfo, 
                        appState.passkey,
                        appState.laCaleEmail,
                        appState.laCalePassword
                    );
                } catch (e) {
                    console.error("La Cale upload error:", e);
                    
                    // Rollback qBittorrent if needed
                    if (appState.qbitUrl) {
                        try {
                            console.log("Rolling back qBittorrent upload...");
                            await RemoveFromQBittorrent(generatedTorrentPath, appState.qbitUrl, appState.qbitUsername, appState.qbitPassword);
                        } catch (rbError) {
                            console.error("Rollback failed:", rbError);
                        }
                    }

                    alert("La Cale upload failed: " + e + "\n(Rolled back qBittorrent upload if applicable)");
                    isUploading = false;
                    await cleanupFiles();
                    return;
                }
            } else {
                    if (!confirm("Missing La Cale settings (Passkey or Email)! Skipping La Cale upload. Mark as done locally?")) {
                    isUploading = false;
                    await cleanupFiles();
                    return;
                    }
            }

            // 3. Mark Done
            await MarkProcessed(workingPath);
            await cleanupFiles();
            navigate('/');
        } catch (e) {
             console.error(e);
             alert("Error during completion: " + e);
             await cleanupFiles();
        } finally {
            isUploading = false;
        }
    }

    async function openTorrentLocation() {
        if (generatedTorrentPath) {
            try {
                await OpenFileLocation(generatedTorrentPath);
            } catch (e) {
                console.error("Failed to open location:", e);
            }
        }
    }

    async function handleOpenNfo() {
        if (!generatedNfoPath && !nfoContent) return;
        
        try {
             // If we have content but no path (or update), ensure saved?
             // User requested "Generate -> Auto Save", "Button -> Open"
             // Use the path if we have it from generation
             let targetPath = generatedNfoPath;
             
             if (!targetPath && workingPath && nfoContent) {
                 // Fallback save if needed
                 targetPath = await SaveNfo(workingPath, nfoContent);
                 generatedNfoPath = targetPath;
             } else if (targetPath && nfoContent) {
                 // Update file with current content before opening (in case of manual edits)
                 await SaveNfo(workingPath, nfoContent);
             }

            if (targetPath) {
                 await OpenFileLocation(targetPath);
            }
        } catch (e) {
            console.error(e);
            alert("Error opening NFO: " + e);
        }
    }
</script>

<div class="p-6 max-w-7xl mx-auto">
    {#if step === 'select-type'}
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-purple-400 mb-8 text-center">What are you processing?</h2>
            <div class="grid {isInputDirectory ? 'grid-cols-3' : 'grid-cols-2'} gap-6">
                <!-- Select Type Buttons -->
                <button 
                    onclick={() => handleTypeSelection('movie')}
                    class="flex flex-col items-center justify-center p-6 bg-zinc-900 border-2 border-zinc-700 rounded-xl hover:border-purple-500 hover:bg-zinc-800 transition-all group"
                >
                    <Icon icon="mdi:movie" class="text-5xl text-gray-400 group-hover:text-purple-500 mb-3 transition-colors" />
                    <span class="text-lg font-bold text-gray-300 group-hover:text-white">Movie</span>
                    <span class="text-xs text-zinc-500 mt-2 text-center">Single Movie File</span>
                </button>

                <button 
                    onclick={() => handleTypeSelection('episode')}
                    class="flex flex-col items-center justify-center p-6 bg-zinc-900 border-2 border-zinc-700 rounded-xl hover:border-purple-500 hover:bg-zinc-800 transition-all group"
                >
                    <Icon icon="mdi:television" class="text-5xl text-gray-400 group-hover:text-purple-500 mb-3 transition-colors" />
                    <span class="text-lg font-bold text-gray-300 group-hover:text-white">Single Episode</span>
                    <span class="text-xs text-zinc-500 mt-2 text-center">One entry in series</span>
                </button>

                {#if isInputDirectory}
                <button 
                    onclick={() => handleTypeSelection('season')}
                    class="flex flex-col items-center justify-center p-6 bg-zinc-900 border-2 border-zinc-700 rounded-xl hover:border-purple-500 hover:bg-zinc-800 transition-all group"
                >
                    <Icon icon="mdi:folder-multiple-image" class="text-5xl text-gray-400 group-hover:text-purple-500 mb-3 transition-colors" />
                    <span class="text-lg font-bold text-gray-300 group-hover:text-white">Season Pack</span>
                    <span class="text-xs text-zinc-500 mt-2 text-center">Multiple episodes</span>
                </button>
                {/if}
            </div>
            
            <div class="mt-8 text-center text-zinc-500 font-mono text-sm">
                Target: {appState.processingPath}
            </div>
        </div>

    {:else}
        <div class="flex gap-8 items-start">
            <!-- Left Roadmap -->
            <div class="w-64 shrink-0 sticky top-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
                <div class="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">Steps</div>
                
                <!-- Steps List -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3 {isAnalysisDone ? 'text-green-400' : 'text-zinc-500'}">
                        <div class="w-2 h-2 rounded-full {isAnalysisDone ? 'bg-green-500 shadow-[0_0_8px_rgba(72,187,120,0.5)]' : 'bg-zinc-700'}"></div>
                        <span class="text-sm font-medium">Analysis</span>
                        {#if isAnalysisDone}<Icon icon="mdi:check" class="ml-auto" />{/if}
                    </div>

                    <div class="flex items-center gap-3 {isTmdbDone ? 'text-green-400' : 'text-zinc-500'}">
                        <div class="w-2 h-2 rounded-full {isTmdbDone ? 'bg-green-500 shadow-[0_0_8px_rgba(72,187,120,0.5)]' : 'bg-zinc-700'}"></div>
                        <span class="text-sm font-medium">Identification</span>
                        {#if isTmdbDone}<Icon icon="mdi:check" class="ml-auto" />{/if}
                    </div>

                    <div class="flex items-center gap-3 {isNameDone ? 'text-green-400' : 'text-zinc-500'}">
                        <div class="w-2 h-2 rounded-full {isNameDone ? 'bg-green-500 shadow-[0_0_8px_rgba(72,187,120,0.5)]' : 'bg-zinc-700'}"></div>
                        <span class="text-sm font-medium">Naming</span>
                        {#if isNameDone}<Icon icon="mdi:check" class="ml-auto" />{/if}
                    </div>

                    <div class="flex items-center gap-3 {isNfoDone ? 'text-green-400' : 'text-zinc-500'}">
                        <div class="w-2 h-2 rounded-full {isNfoDone ? 'bg-green-500 shadow-[0_0_8px_rgba(72,187,120,0.5)]' : 'bg-zinc-700'}"></div>
                        <span class="text-sm font-medium">NFO</span>
                        {#if isNfoDone}<Icon icon="mdi:check" class="ml-auto" />{/if}
                    </div>

                    <div class="flex items-center gap-3 {isTorrentDone ? 'text-green-400' : 'text-zinc-500'}">
                        <div class="w-2 h-2 rounded-full {isTorrentDone ? 'bg-green-500 shadow-[0_0_8px_rgba(72,187,120,0.5)]' : 'bg-zinc-700'}"></div>
                        <span class="text-sm font-medium">Torrent</span>
                        {#if isTorrentDone}<Icon icon="mdi:check" class="ml-auto" />{/if}
                    </div>
                </div>

                <div class="pt-6 mt-6 border-t border-zinc-800">
                    <div class="text-xs text-zinc-500 mb-2">Completion</div>
                    <div class="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div 
                            class="bg-purple-600 h-full transition-all duration-500 ease-out"
                            style="width: {[isAnalysisDone, isTmdbDone, isNameDone, isNfoDone, isTorrentDone].filter(Boolean).length / 5 * 100}%"
                        ></div>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 space-y-8 min-w-0">
                <div class="flex items-center justify-between border-b border-zinc-700 pb-4">
                    <h2 class="text-xl font-bold text-gray-200">Processing: <span class="text-purple-400">{mediaType.toUpperCase()}</span></h2>
                </div>
                
                <div class="bg-zinc-900/50 p-4 rounded border border-zinc-800 mb-6 font-mono text-xs text-zinc-400 break-all">
                    {workingPath}
                </div>

                <!-- Release Info Tags -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold {isAnalysisDone ? 'text-green-400' : 'text-purple-300'} flex items-center gap-2">
                        <Icon icon="mdi:tag-multiple" /> Release Tags
                        {#if isAnalysisDone}<Icon icon="mdi:check-circle" class="text-green-500" />{/if}
                    </h3>
                    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                        <div class="mb-4">
                            <label class="block text-xs text-zinc-500 uppercase font-bold mb-1">Detected Title</label>
                            <div class="text-xl font-bold text-white">{releaseInfo.title || 'Unknown Title'}</div>
                        </div>
                        
                        <div class="flex flex-wrap gap-2">
                            {#if releaseInfo.year}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-blue-400">
                                    {releaseInfo.year}
                                </span>
                            {/if}
                            {#if releaseInfo.season}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-yellow-400">
                                    {releaseInfo.season}
                                </span>
                            {/if}
                            {#if releaseInfo.episode}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-yellow-400">
                                    {releaseInfo.episode}
                                </span>
                            {/if}
                            {#if releaseInfo.resolution}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-green-400 uppercase">
                                    {releaseInfo.resolution}
                                </span>
                            {/if}
                            {#if releaseInfo.source}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-purple-400">
                                    {releaseInfo.source}
                                </span>
                            {/if}
                            {#if releaseInfo.codec}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-pink-400 uppercase">
                                    {releaseInfo.codec}
                                </span>
                            {/if}
                            {#if releaseInfo.audio}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-orange-400 uppercase">
                                    {releaseInfo.audio}
                                </span>
                            {/if}
                            {#if releaseInfo.audioLanguages && releaseInfo.audioLanguages.length > 0}
                                {#each releaseInfo.audioLanguages as lang}
                                    <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-red-400 flex items-center gap-1">
                                        <Icon icon="mdi:microphone" class="w-3 h-3" /> {lang}
                                    </span>
                                {/each}
                            {/if}
                            {#if releaseInfo.subtitleLanguages && releaseInfo.subtitleLanguages.length > 0}
                                {#each releaseInfo.subtitleLanguages as lang}
                                    <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-gray-400 flex items-center gap-1">
                                        <Icon icon="mdi:subtitles" class="w-3 h-3" /> {lang}
                                    </span>
                                {/each}
                            {/if}
                            {#if releaseInfo.audioChannels}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-orange-400">
                                    {releaseInfo.audioChannels}
                                </span>
                            {/if}
                            {#if releaseInfo.language}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-red-400 uppercase">
                                    {releaseInfo.language}
                                </span>
                            {/if}
                            {#if releaseInfo.hdr}
                                {#each releaseInfo.hdr as h}
                                    <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-cyan-400 uppercase">
                                        {h}
                                    </span>
                                {/each}
                            {/if}
                            {#if releaseInfo.releaseGroup}
                                <span class="px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-gray-400">
                                    -{releaseInfo.releaseGroup}
                                </span>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- 1. TMDB -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold {isTmdbDone ? 'text-green-400' : 'text-purple-300'} flex items-center gap-2">
                        <Icon icon="mdi:search" /> TMDB Identification
                        {#if isTmdbDone}<Icon icon="mdi:check-circle" class="text-green-500" />{/if}
                    </h3>
                    
                    {#if selectedTmdbItem}
                        <div class="flex items-start gap-4 p-4 bg-zinc-900 border border-green-500/30 rounded-lg relative">
                            {#if selectedTmdbItem.poster_path}
                                <img src={`https://image.tmdb.org/t/p/w92${selectedTmdbItem.poster_path}`} alt="Poster" class="w-16 h-24 object-cover rounded" />
                            {:else}
                                <div class="w-16 h-24 bg-zinc-800 rounded flex items-center justify-center text-zinc-600">No Img</div>
                            {/if}
                            <div class="flex-1">
                                <h4 class="font-bold text-white text-lg">{selectedTmdbItem.title || selectedTmdbItem.name}</h4>
                                <p class="text-sm text-zinc-400">
                                    {new Date(selectedTmdbItem.release_date || selectedTmdbItem.first_air_date).getFullYear() || 'Unknown Year'} • ID: {selectedTmdbItem.id}
                                </p>
                                <p class="text-xs text-zinc-500 mt-1 line-clamp-2">{selectedTmdbItem.overview}</p>
                            </div>
                            <button onclick={() => selectedTmdbItem = null} class="p-2 text-zinc-500 hover:text-red-400 absolute top-2 right-2">
                                <Icon icon="mdi:close" />
                            </button>
                        </div>
                    {:else}
                        <div class="relative">
                            <div class="flex gap-4">
                                <input 
                                    type="text" 
                                    bind:value={tmdbQuery}
                                    onkeydown={(e) => e.key === 'Enter' && searchTmdb()}
                                    placeholder="Search for {mediaType === 'movie' ? 'movie' : 'series'}..." 
                                    class="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                                <button onclick={searchTmdb} class="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium min-w-[100px]" disabled={tmdbLoading}>
                                    {tmdbLoading ? '...' : 'Search'}
                                </button>
                            </div>

                            {#if tmdbResults.length > 0}
                                <div class="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-20 max-h-80 overflow-y-auto">
                                    {#each tmdbResults as item}
                                        <button 
                                            onclick={() => selectTmdbItem(item)}
                                            class="w-full flex items-center gap-4 p-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
                                        >
                                            {#if item.poster_path}
                                                <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="Poster" class="w-10 h-14 object-cover rounded bg-zinc-800" />
                                            {:else}
                                                <div class="w-10 h-14 bg-zinc-800 rounded flex items-center justify-center text-xs text-zinc-600">N/A</div>
                                            {/if}
                                            <div>
                                                <div class="font-medium text-gray-200">{item.title || item.name}</div>
                                                <div class="text-xs text-zinc-500">
                                                    {new Date(item.release_date || item.first_air_date).getFullYear() || 'Unknown'} • {item.id}
                                                </div>
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- 2. Torrent Name -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold {isNameDone ? 'text-green-400' : 'text-purple-300'} flex items-center gap-2">
                        <Icon icon="mdi:tag-text" /> Torrent Name
                        {#if isNameDone}<Icon icon="mdi:check-circle" class="text-green-500" />{/if}
                    </h3>
                    <input 
                        type="text" 
                        bind:value={torrentName}
                        class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                </div>

                <!-- 3. NFO File -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold {isNfoDone ? 'text-green-400' : 'text-purple-300'} flex items-center gap-2">
                        <Icon icon="mdi:file-document-outline" /> .nfo File
                        {#if isNfoDone}<Icon icon="mdi:check-circle" class="text-green-500" />{/if}
                    </h3>
                    
                    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                        <div class="flex items-center justify-end gap-4 mb-3">
                            <div class="flex gap-2">
                                <button 
                                    onclick={generateNfo} 
                                    class="px-4 py-2 bg-zinc-800 hover:bg-purple-600 hover:text-white border border-zinc-600 rounded transition-colors flex items-center gap-2 text-zinc-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isGeneratingNfo || !analyzingFile}
                                >
                                    {#if isGeneratingNfo}
                                        <Icon icon="eos-icons:loading" /> Generating...
                                    {:else}
                                        <Icon icon="mdi:text-box-search-outline" /> Generate from MediaInfo
                                    {/if}
                                </button>
                                {#if nfoContent}
                                    <button 
                                        onclick={handleOpenNfo} 
                                        class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-600 rounded transition-colors flex items-center gap-2 text-zinc-300 text-xs"
                                    >
                                        <Icon icon="mdi:folder-open" /> Open .nfo
                                    </button>
                                {/if}
                            </div>
                        </div>
                        
                        <textarea 
                            bind:value={nfoContent}
                            placeholder="NFO content will appear here..."
                            class="w-full h-48 bg-zinc-950 border border-zinc-800 rounded p-3 font-mono text-xs text-green-400 focus:outline-none focus:border-purple-500 resize-y"
                        ></textarea>
                    </div>
                </div>

                <!-- 4. Torrent File -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold {isTorrentDone ? 'text-green-400' : 'text-purple-300'} flex items-center gap-2">
                        <Icon icon="mdi:file-download-outline" /> .torrent File
                        {#if isTorrentDone}<Icon icon="mdi:check-circle" class="text-green-500" />{/if}
                    </h3>
                    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                        <div class="flex flex-col gap-4">
                            <div class="flex items-center gap-4">
                                <input 
                                    type="text"
                                    value={generatedTorrentPath} 
                                    readonly 
                                    onclick={openTorrentLocation}
                                    placeholder="Path to .torrent file"
                                    class="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-gray-300 focus:outline-none font-mono text-xs cursor-pointer hover:border-purple-500 transition-colors"
                                />
                                <button 
                                    onclick={handleCreateTorrent}
                                    disabled={isCreatingTorrent || !workingPath}
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 flex items-center gap-2 text-sm transition-colors whitespace-nowrap"
                                >
                                    {#if isCreatingTorrent}
                                        <Icon icon="eos-icons:loading" /> Creating...
                                    {:else}
                                        <Icon icon="mdi:plus-box" /> Create New
                                    {/if}
                                </button>
                            </div>
                            
                            <div class="flex justify-between items-center text-xs">
                                {#if appState.torrentTrackers}
                                    <div class="text-zinc-500">
                                        Including {appState.torrentTrackers.split('\n').filter(t => t.trim().length > 0).length} trackers from settings.
                                    </div>
                                {:else}
                                    <div class="text-yellow-500 flex items-center gap-1">
                                        <Icon icon="mdi:alert-circle-outline" /> No trackers configured in settings.
                                    </div>
                                {/if}
                                {#if generatedTorrentPath}
                                    <span class="text-green-500 font-bold flex items-center gap-1"><Icon icon="mdi:check-circle" /> Created</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 5. Complete -->
                <div class="pt-8 border-t border-zinc-800 flex items-center justify-end gap-4">
                    <button 
                        onclick={handleCancel} 
                        class="px-6 py-3 text-gray-400 hover:text-white font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onclick={handleMarkDone} 
                        disabled={!allStepsDone || isUploading}
                        class="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed text-white rounded font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all"
                    >
                        {#if isUploading}
                             <Icon icon="eos-icons:loading" /> Uploading...
                        {:else}
                            <Icon icon="mdi:check" /> Complete & Mark Done
                        {/if}
                    </button>
                </div>

            </div>
        </div>
    {/if}
</div>
