import { GetSettings, SaveSettings } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

export class AppState {
    selectedPath = $state("");
    torrentTrackers = $state("");
    isPrivateTorrent = $state(false);
    passkey = $state("");
    
    // QBit settings
    qbitUrl = $state("");
    qbitUsername = $state("");
    qbitPassword = $state("");
    
    // Processing state
    processingPath = $state("");
    processingIsDir = $state(false);

    setPath(path: string) {
        this.selectedPath = path;
    }

    async load() {
        try {
            const settings = await GetSettings();
            if (settings) {
                this.torrentTrackers = settings.torrentTrackers || "";
                this.isPrivateTorrent = settings.isPrivateTorrent || false;
                this.passkey = settings.passkey || "";
                this.qbitUrl = settings.qbitUrl || "";
                this.qbitUsername = settings.qbitUsername || "";
                this.qbitPassword = settings.qbitPassword || "";
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    }

    async save() {
        try {
            const settings = new main.AppSettings({
                torrentTrackers: this.torrentTrackers,
                isPrivateTorrent: this.isPrivateTorrent,
                passkey: this.passkey,
                qbitUrl: this.qbitUrl,
                qbitUsername: this.qbitUsername,
                qbitPassword: this.qbitPassword,
            });
            await SaveSettings(settings);
            console.log("Settings saved");
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }
}


// Export a single shared instance
export const appState = new AppState();
