<script lang="ts">
    import { appState } from "../lib/appState.svelte";
    import { ClearProcessedFiles } from "../../wailsjs/go/main/App";
    import Icon from '@iconify/svelte';

    async function handleClearDatabase() {
        if (confirm("Are you sure you want to delete all records of processed files?")) {
            if (confirm("DOUBLE CHECK: This action is irreversible. Are you absolutely sure?")) {
                try {
                    await ClearProcessedFiles();
                    alert("History cleared successfully.");
                } catch (e) {
                    console.error(e);
                    alert("Error clearing history: " + e);
                }
            }
        }
    }
</script>

<div class="p-6 max-w-2xl mx-auto">
    <h2 class="text-2xl font-bold text-purple-400 mb-6">Settings</h2>

    <div class="space-y-6">
        <!-- Torrent Trackers Section -->
        <div class="space-y-2">
            <label for="passkey" class="block text-sm font-medium text-gray-300">
                La-Cale.space Passkey
            </label>
            <input
                type="text"
                id="passkey"
                bind:value={appState.passkey}
                onchange={() => appState.save()}
                class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                placeholder="Enter your passkey..."
            />
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
                <label for="lacale-email" class="block text-sm font-medium text-gray-300">
                    La-Cale Email
                </label>
                <input
                    type="email"
                    id="lacale-email"
                    bind:value={appState.laCaleEmail}
                    onchange={() => appState.save()}
                    class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                    placeholder="email@example.com"
                />
            </div>
            <div class="space-y-2">
                <label for="lacale-password" class="block text-sm font-medium text-gray-300">
                    La-Cale Password
                </label>
                <input
                    type="password"
                    id="lacale-password"
                    bind:value={appState.laCalePassword}
                    onchange={() => appState.save()}
                    class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                    placeholder="••••••••"
                />
            </div>
        </div>

        <div class="space-y-2">
            <label for="trackers" class="block text-sm font-medium text-gray-300">
                Torrent Trackers (one per line)
            </label>
            <textarea
                id="trackers"
                bind:value={appState.torrentTrackers}
                onchange={() => appState.save()}
                rows="6"
                class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors resize-none placeholder-zinc-600"
                placeholder="udp://tracker.opentrackr.org:1337/announce..."
            ></textarea>
        </div>

        <!-- Private Torrent Section -->
        <div class="flex items-center space-x-3 p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
            <input
                type="checkbox"
                id="private-torrent"
                bind:checked={appState.isPrivateTorrent}
                onchange={() => appState.save()}
                class="w-5 h-5 text-purple-600 bg-zinc-800 border-zinc-600 rounded focus:ring-purple-500 focus:ring-offset-zinc-900"
            />
            <label for="private-torrent" class="flex flex-col cursor-pointer select-none">
                <span class="text-gray-200 font-medium">Private Torrent</span>
                <span class="text-xs text-zinc-500">Enable this flag if you are using a private tracker</span>
            </label>
        </div>

        <!-- qBittorrent Section -->
        <div class="space-y-4 pt-6 border-t border-zinc-800">
            <h3 class="text-lg font-semibold text-purple-400">qBittorrent Configuration</h3>
            
            <div class="grid gap-4">
                <div class="space-y-2">
                    <label for="qbit-url" class="block text-sm font-medium text-gray-300">
                        WebUI URL (e.g. http://localhost:8080)
                    </label>
                    <input
                        type="text"
                        id="qbit-url"
                        bind:value={appState.qbitUrl}
                        onchange={() => appState.save()}
                        class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                        placeholder="http://localhost:8080"
                    />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label for="qbit-user" class="block text-sm font-medium text-gray-300">
                            Username
                        </label>
                        <input
                            type="text"
                            id="qbit-user"
                            bind:value={appState.qbitUsername}
                            onchange={() => appState.save()}
                            class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                            placeholder="admin"
                        />
                    </div>
                    
                    <div class="space-y-2">
                        <label for="qbit-pass" class="block text-sm font-medium text-gray-300">
                            Password
                        </label>
                        <input
                            type="password"
                            id="qbit-pass"
                            bind:value={appState.qbitPassword}
                            onchange={() => appState.save()}
                            class="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors placeholder-zinc-600"
                            placeholder="••••••"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Danger Zone -->
        <div class="pt-8 border-t border-red-900/30">
            <h3 class="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
            <button 
                onclick={handleClearDatabase}
                class="px-4 py-3 bg-red-900/20 border border-red-900/50 hover:bg-red-900/40 text-red-200 rounded-lg flex items-center gap-3 transition-colors w-full justify-center group"
            >
                <Icon icon="mdi:delete-alert" class="text-xl group-hover:text-red-100" />
                <span>Delete Processed Files History</span>
            </button>
        </div>
    </div>
</div>
