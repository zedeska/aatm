export interface ReleaseInfo {
  title?: string;
  year?: string;
  season?: string;
  episode?: string;
  resolution?: string;
  source?: string;
  codec?: string;
  audio?: string;
  audioChannels?: string;
  language?: string;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  hdr?: string[];
  tags?: string[];
  releaseGroup?: string;
  container?: string;
  genres?: string[];
}

function parseMediaInfo(nfo: string): Partial<ReleaseInfo> {
  const info: Partial<ReleaseInfo> = {};

  // Container / Format
  // Usually starts with "Format : Matroska" or "Format : MPEG-4"
  // We check the first few lines or valid format lines
  if (nfo.match(/Format\s*:\s*Matroska/i)) info.container = 'MKV';
  else if (nfo.match(/Format\s*:\s*MPEG-4/i)) info.container = 'MP4';
  else if (nfo.match(/Format\s*:\s*AVI/i) || nfo.match(/Format\s*:\s*Audio Video Interleave/i)) info.container = 'AVI';
  else if (nfo.match(/Format\s*:\s*BDAV/i)) info.container = 'BluRay'; // ISO/Folder structure often
  
  // resolution
  if (nfo.includes('Height')) {
      const match = nfo.match(/Height\s*:\s*([\d\s]+)/);
      if (match) {
          const cleanHeight = match[1].replace(/\s/g, '');
          const h = parseInt(cleanHeight, 10);
          if (h >= 2100) info.resolution = '2160p';
          else if (h >= 1000) info.resolution = '1080p';
          else if (h >= 700) info.resolution = '720p';
          else if (h >= 570) info.resolution = '576p'; 
          else info.resolution = '480p';
      }
  }

  // Codec
  if (nfo.match(/Format\s*:\s*HEVC/i) || nfo.match(/Writing library\s*:\s*x265/i)) {
      info.codec = 'x265';
  } else if (nfo.match(/Format\s*:\s*AVC/i) || nfo.match(/Writing library\s*:\s*x264/i)) {
      info.codec = 'x264';
  } else if (nfo.match(/Format\s*:\s*AV1/i)) {
      info.codec = 'AV1';
  } else if (nfo.match(/Format\s*:\s*MPEG-4\s*Visual/i) || nfo.match(/Format\s*:\s*XviD/i)) {
      info.codec = 'XviD';
  }

  // Audio & Channels
  
  if (nfo.match(/Format\s*:\s*E-AC-3/i)) info.audio = 'EAC3';
  else if (nfo.match(/Format\s*:\s*AC-3/i)) info.audio = 'AC3';
  else if (nfo.match(/Format\s*:\s*DTS\s*X/i)) info.audio = 'DTS-X';
  else if (nfo.match(/Format\s*:\s*DTS-HD/i)) info.audio = 'DTS-HD';
  else if (nfo.match(/Format\s*:\s*DTS/i)) info.audio = 'DTS';
  else if (nfo.match(/Format\s*:\s*TrueHD/i)) info.audio = 'TrueHD';
  else if (nfo.match(/Format\s*:\s*AAC/i)) info.audio = 'AAC';
  else if (nfo.match(/Format\s*:\s*FLAC/i)) info.audio = 'FLAC';
  else if (nfo.match(/Format\s*:\s*Opus/i)) info.audio = 'Opus';
  else if (nfo.match(/Format\s*:\s*Vorbis/i)) info.audio = 'Vorbis';

  // Channels
  // Max channels found
  const channelMatches = [...nfo.matchAll(/Channel\(s\)\s*:\s*(\d+)/g)];
  if (channelMatches.length > 0) {
      // Find max channels
      const maxCh = Math.max(...channelMatches.map(m => parseInt(m[1], 10)));
      if (maxCh >= 8) info.audioChannels = '7.1';
      else if (maxCh >= 6) info.audioChannels = '5.1';
      else if (maxCh >= 2) info.audioChannels = '2.0'; // Sometimes 2.0 is just displayed as 2
      else if (maxCh >= 1) info.audioChannels = '1.0';
  }

  // Language Detection
  // Split bits by double newlines or section headers to process audio tracks separately
  // We try to rely on "Audio" or "Text" headers more strictly
  const sections = nfo.split(/(?:\r?\n){2,}/);
  
  let frenchAudio = false;
  let nonFrenchAudio = false;
  let frenchSub = false;

  const audioLangs = new Set<string>();
  const subLangs = new Set<string>();
  
  for (const s of sections) {
      // Check for section type headers
      const audioHeader = s.match(/^Audio\s*(?:#\d+)?/im);
      const textHeader = s.match(/^(?:Text|Subtitle)\s*(?:#\d+)?/im);
      
      // Fallback heuristics if no clear header
      const hasAudioProps = s.includes('Channel(s)') && s.includes('Sampling rate');
      
      if (audioHeader || (!textHeader && hasAudioProps)) {
           // It's an audio section (Check language)
           const langMatch = s.match(/Language\s*:\s*([^\r\n]+)/i);
           // Special check: sometimes "Language" line is not present for English default, 
           // but normally MediaInfo lists it.
           if (langMatch) {
               const lang = langMatch[1].trim(); 
               // Ignore if lang contains "Impaired" or technical details if we strictly want language code/name.
               // But usually "English", "French" is robust.
               const lowerLang = lang.toLowerCase();
               audioLangs.add(lang);

               if (lowerLang.includes('french') || lowerLang.includes('français')) frenchAudio = true;
               else nonFrenchAudio = true;
           }
      } else if (textHeader) {
           // Subtitles
           const langMatch = s.match(/Language\s*:\s*([^\r\n]+)/i);
           if (langMatch) {
               const lang = langMatch[1].trim();
               subLangs.add(lang);
               const lowerLang = lang.toLowerCase();
               if (lowerLang.includes('french') || lowerLang.includes('français')) frenchSub = true;
           }
      }
  }

  if (audioLangs.size > 0) info.audioLanguages = Array.from(audioLangs);
  if (subLangs.size > 0) info.subtitleLanguages = Array.from(subLangs);

  if (frenchAudio && nonFrenchAudio) info.language = 'MULTi';
  else if (frenchAudio) info.language = 'FRENCH';
  else if (frenchSub) info.language = 'VOSTFR';

  // HDR
  const hdr: string[] = [];
  if (nfo.includes('HDR10+')) hdr.push('HDR10+');
  else if (nfo.includes('HDR10') || nfo.match(/SMPTE ST 2086/)) hdr.push('HDR10');
  
  if (nfo.includes('Dolby Vision') || nfo.includes('DV')) hdr.push('DV');
  
  if (hdr.length > 0) info.hdr = hdr;

  return info;
}

export function parseReleaseName(name: string, nfoContent?: string): ReleaseInfo {
  const info: ReleaseInfo = {};
  let cleanName = name.trim();

  // Extract Release Group (usually at the end after a hyphen)
  // We do this first but don't remove it from the string immediately for index calculation, 
  // or we can just extract it and ignore it for the rest.
  // Standard scene naming: Name.Tags-Group
  const groupMatch = cleanName.match(/-([a-zA-Z0-9\[\]]+)$/);
  if (groupMatch) {
    info.releaseGroup = groupMatch[1];
    // We keep the string intact for now to find the "end" of the title naturally via tags
    // cleanName = cleanName.substring(0, groupMatch.index);
  }

  // Define regex patterns
  // Using case insensitive flags generally, but some specific tags might need care.
  // user requested to stop analyzing title for tags, only keep basic info
  const patterns = {
    year: /\b(19|20)\d{2}\b/g,
    // resolution: ... disabled
    season: /\b(?:S|Season)\s?(\d{1,2})\b|\b(Complete|Integrale)\b/gi, // Simple Season match
    episode: /\b(?:E|Episode)\s?(\d{1,3})\b/gi,
    seasonEpisode: /\bS(\d{1,2})E(\d{1,3})\b/gi, // Combined S01E01
    source: /\b(Bluray|BluRay|BDRip|BRRip|WEBRip|WebRip|WEB-DL|WEBDL|HDTV|PDTV|DVD|DVDRip)\b/gi,
  };


  // Helper to find match and return data, also tracking the earliest index found
  let firstTagIndex = cleanName.length;

  const findMatch = (pattern: RegExp, type: keyof ReleaseInfo | 'seasonEpisode') => {
    // Reset lastIndex because we are reusing global regexes or iterating
    pattern.lastIndex = 0;
    const match = pattern.exec(cleanName);
    if (match) {
      if (match.index < firstTagIndex) {
        firstTagIndex = match.index;
      }
      return match;
    }
    return null;
  };

  // 1. Year
  const yearMatch = findMatch(patterns.year, 'year');
  if (yearMatch) info.year = yearMatch[0];

  // 2. Resolution (Disabled)
  // const resMatch = findMatch(patterns.resolution, 'resolution');
  // if (resMatch) info.resolution = resMatch[0].toLowerCase();

  // 3. Season/Episode
  // Check for SxxExx first
  const sxeMatch = findMatch(patterns.seasonEpisode, 'seasonEpisode');
  if (sxeMatch) {
    info.season = "S" + sxeMatch[1].padStart(2, '0');
    info.episode = "E" + sxeMatch[2].padStart(2, '0');
  } else {
    // Check individual Season
    const seasonMatch = findMatch(patterns.season, 'season');
    if (seasonMatch) {
        // checks for 'Complete' or 'Integrale'
        if (seasonMatch[2]) {
             info.season = seasonMatch[2].toUpperCase();
        } else {
             info.season = "S" + seasonMatch[1].padStart(2, '0');
        }
    }
    
    // Check individual Episode
    const epMatch = findMatch(patterns.episode, 'episode');
    if (epMatch) info.episode = "E" + epMatch[1].padStart(2, '0');
  }

  // 4. Source
  const sourceMatch = findMatch(patterns.source, 'source');
  if (sourceMatch) info.source = sourceMatch[0];

  /* 
  // Disabled other patterns if needed, but keeping Source enabled as it is rarely in NFO
  // ... 
  */

  // Extract Title
  // The title is generally everything from the start up to the first discovered tag.
  // We also strip dots and underscores.
  let potentialTitle = cleanName.substring(0, firstTagIndex);
  
  // Clean up title
  potentialTitle = potentialTitle
    .replace(/\./g, ' ') // dots to spaces
    .replace(/_/g, ' ') // underscores to spaces
    .trim();
    
  // Remove trailing hyphens or parenthesis often found before year
  potentialTitle = potentialTitle.replace(/[-()]+$/, '').trim();

  if (potentialTitle) {
    info.title = potentialTitle;
  }

  // Release Group (already extracted, but checking if it was inside the title area strictly shouldn't happen in standard naming)
  
  if (nfoContent) {
      const nfoInfo = parseMediaInfo(nfoContent);
      if (nfoInfo.resolution) info.resolution = nfoInfo.resolution;
      if (nfoInfo.codec) info.codec = nfoInfo.codec;
      if (nfoInfo.audio) info.audio = nfoInfo.audio;
      if (nfoInfo.audioChannels) info.audioChannels = nfoInfo.audioChannels;
      if (nfoInfo.hdr) info.hdr = nfoInfo.hdr;
      if (nfoInfo.audioLanguages) info.audioLanguages = nfoInfo.audioLanguages;
      if (nfoInfo.subtitleLanguages) info.subtitleLanguages = nfoInfo.subtitleLanguages;
      // We keep filename based language if nfo is ambiguous, but usually nfo is better?
      // For now, if nfo detected multi/french, we might want to override. 
      // Existing logic does not override info.language yet, let's add it if nfo has it
      if (nfoInfo.language) info.language = nfoInfo.language;
      if (nfoInfo.container) info.container = nfoInfo.container;
  }

  return info;
}
