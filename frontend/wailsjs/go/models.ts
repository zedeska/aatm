export namespace main {
	
	export class AppSettings {
	    torrentTrackers: string;
	    isPrivateTorrent: boolean;
	    passkey: string;
	    qbitUrl: string;
	    qbitUsername: string;
	    qbitPassword: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.torrentTrackers = source["torrentTrackers"];
	        this.isPrivateTorrent = source["isPrivateTorrent"];
	        this.passkey = source["passkey"];
	        this.qbitUrl = source["qbitUrl"];
	        this.qbitUsername = source["qbitUsername"];
	        this.qbitPassword = source["qbitPassword"];
	    }
	}
	export class FileInfo {
	    name: string;
	    size: number;
	    isDir: boolean;
	    isProcessed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.isDir = source["isDir"];
	        this.isProcessed = source["isProcessed"];
	    }
	}
	export class ReleaseInfo {
	    title: string;
	    year: string;
	    season: string;
	    episode: string;
	    resolution: string;
	    source: string;
	    codec: string;
	    audio: string;
	    audioChannels: string;
	    language: string;
	    hdr: string[];
	    releaseGroup: string;
	
	    static createFrom(source: any = {}) {
	        return new ReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.year = source["year"];
	        this.season = source["season"];
	        this.episode = source["episode"];
	        this.resolution = source["resolution"];
	        this.source = source["source"];
	        this.codec = source["codec"];
	        this.audio = source["audio"];
	        this.audioChannels = source["audioChannels"];
	        this.language = source["language"];
	        this.hdr = source["hdr"];
	        this.releaseGroup = source["releaseGroup"];
	    }
	}

}

