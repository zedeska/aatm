export namespace http {
	
	export class Client {
	    Transport: any;
	    Jar: any;
	    Timeout: number;
	
	    static createFrom(source: any = {}) {
	        return new Client(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Transport = source["Transport"];
	        this.Jar = source["Jar"];
	        this.Timeout = source["Timeout"];
	    }
	}

}

export namespace main {
	
	export class AppSettings {
	    torrentTrackers: string;
	    isPrivateTorrent: boolean;
	    passkey: string;
	    laCaleEmail: string;
	    laCalePassword: string;
	    qbitUrl: string;
	    qbitUsername: string;
	    qbitPassword: string;
	    showProcessed: boolean;
	    showNotProcessed: boolean;
	    isFullAuto: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.torrentTrackers = source["torrentTrackers"];
	        this.isPrivateTorrent = source["isPrivateTorrent"];
	        this.passkey = source["passkey"];
	        this.laCaleEmail = source["laCaleEmail"];
	        this.laCalePassword = source["laCalePassword"];
	        this.qbitUrl = source["qbitUrl"];
	        this.qbitUsername = source["qbitUsername"];
	        this.qbitPassword = source["qbitPassword"];
	        this.showProcessed = source["showProcessed"];
	        this.showNotProcessed = source["showNotProcessed"];
	        this.isFullAuto = source["isFullAuto"];
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
	    audioLanguages: string[];
	    subtitleLanguages: string[];
	    hdr: string[];
	    tags: string[];
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
	        this.audioLanguages = source["audioLanguages"];
	        this.subtitleLanguages = source["subtitleLanguages"];
	        this.hdr = source["hdr"];
	        this.tags = source["tags"];
	        this.releaseGroup = source["releaseGroup"];
	    }
	}

}

