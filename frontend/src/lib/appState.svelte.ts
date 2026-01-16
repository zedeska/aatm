import { GetSettings, SaveSettings } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

export class AppState {
    selectedPath = $state("");
    torrentTrackers = $state("");
    isPrivateTorrent = $state(false);
    passkey = $state("");
    
    // La Cale settings
    laCaleEmail = $state("");
    laCalePassword = $state("");
    
    // QBit settings
    qbitUrl = $state("");
    qbitUsername = $state("");
    qbitPassword = $state("");
    
    // List filtering settings
    showProcessed = $state(true);
    showNotProcessed = $state(true);

    // Automation settings
    isFullAuto = $state(false);

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
                this.laCaleEmail = settings.laCaleEmail || "";
                this.laCalePassword = settings.laCalePassword || "";
                this.qbitUrl = settings.qbitUrl || "";
                this.qbitUsername = settings.qbitUsername || "";
                this.qbitPassword = settings.qbitPassword || "";
                this.isFullAuto = settings.isFullAuto || false;
                
                // Load filter settings only if they exist in the DB (default true otherwise)
                // Since they are booleans, we need to be careful with || false check if the property doesn't exist.
                // However, Go struct default is false for bool, but we want true. 
                // Let's assume if the key is missing from JSON it's undefined. 
                // But wails returns the struct, so it will be false if empty? 
                // Actually, if saved previously, it will be correct. If clean install, Go returns false.
                // We might need a migration or intelligent default. 
                // For now, let's treat "undefined" as true, but checking Go zero value is tricky via JSON if not pointer.
                // Ideally backend handles defaults. But let's just assume if it's strictly not in the object...
                // Simpler: Just rely on what comes back, but handle the stored state properly.
                
                // Actually, `settings` is `main.AppSettings`. If we look at models.ts:
                // class AppSettings { ... }
                // If the user has never saved them, they might be false.
                // Let's assume if ALL filtering is disabled (both false), that's invalid, so default to true?
                // Or just load it.
                
                // Let's rely on explicit property presence if possible, or just default to stored value.
                // If it's a fresh DB, they are false. That's annoying for UX. 
                // But we can check if both are false, maybe init them to true?
                // Or just let it be.
                this.showProcessed = (settings.showProcessed !== undefined) ? settings.showProcessed : true;
                this.showNotProcessed = (settings.showNotProcessed !== undefined) ? settings.showNotProcessed : true;

                // Fix for fresh install returning false/false on empty DB struct unmarshal
                if (!settings.torrentTrackers && !settings.passkey && !settings.showProcessed && !settings.showNotProcessed) {
                    this.showProcessed = true;
                    this.showNotProcessed = true;
                }
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
                laCaleEmail: this.laCaleEmail,
                laCalePassword: this.laCalePassword,
                qbitUrl: this.qbitUrl,
                qbitUsername: this.qbitUsername,
                qbitPassword: this.qbitPassword,
                showProcessed: this.showProcessed,
                showNotProcessed: this.showNotProcessed,
                isFullAuto: this.isFullAuto
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
