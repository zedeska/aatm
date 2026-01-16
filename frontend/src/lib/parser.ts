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
  hdr?: string[];
  releaseGroup?: string;
}

function parseMediaInfo(nfo: string): Partial<ReleaseInfo> {
  const info: Partial<ReleaseInfo> = {};

  // resolution
  if (nfo.includes('Height')) {
      const match = nfo.match(/Height\s*:\s*(\d+)/);
      if (match) {
          const h = parseInt(match[1], 10);
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
  }

  // Audio & Channels
  // We try to find the "best" audio or just the first one. 
  // Simple regex scan for keywords might be safer than assuming position.
  
  if (nfo.match(/Format\s*:\s*E-AC-3/i)) info.audio = 'EAC3';
  else if (nfo.match(/Format\s*:\s*AC-3/i)) info.audio = 'AC3';
  else if (nfo.match(/Format\s*:\s*DTS\s*X/i)) info.audio = 'DTS-X'; // Specifics
  else if (nfo.match(/Format\s*:\s*DTS-HD/i)) info.audio = 'DTS-HD';
  else if (nfo.match(/Format\s*:\s*DTS/i)) info.audio = 'DTS';
  else if (nfo.match(/Format\s*:\s*TrueHD/i)) info.audio = 'TrueHD';
  else if (nfo.match(/Format\s*:\s*AAC/i)) info.audio = 'AAC';
  else if (nfo.match(/Format\s*:\s*FLAC/i)) info.audio = 'FLAC';
  else if (nfo.match(/Format\s*:\s*Opus/i)) info.audio = 'Opus';

  // Channels
  // Max channels found
  const channelMatches = [...nfo.matchAll(/Channel\(s\)\s*:\s*(\d+)/g)];
  if (channelMatches.length > 0) {
      // Find max channels
      const maxCh = Math.max(...channelMatches.map(m => parseInt(m[1], 10)));
      if (maxCh === 8) info.audioChannels = '7.1';
      else if (maxCh === 6) info.audioChannels = '5.1';
      else if (maxCh === 2) info.audioChannels = '2.0';
      else if (maxCh === 1) info.audioChannels = '1.0';
  }

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
  const patterns = {
    year: /\b(19|20)\d{2}\b/g,
    resolution: /\b(2160|[48]320|1080|720|576|480)p\b/gi,
    season: /\b(?:S|Season)\s?(\d{1,2})\b|\b(Complete|Integrale)\b/gi, // Simple Season match
    episode: /\b(?:E|Episode)\s?(\d{1,3})\b/gi,
    seasonEpisode: /\bS(\d{1,2})E(\d{1,3})\b/gi, // Combined S01E01
    source: /\b(BluRay|WEB(?:-?DL)?|WEBRip|DVDRip|HDTV|REMUX|FULL[\s.]?Disc|HDLight|UHD)\b/gi,
    codec: /\b(x264|x265|HEVC|AV1|VC-1|VP9|MPEG-?2|H\.?264|H\.?265|XviD|DivX)\b/gi,
    audio: /\b(EAC3|AC3|AAC|DDP|DTS(?:-HD)?|TrueHD|FLAC|MP3|Atmos|PCM)\b/gi,
    audioChannels: /\b(2\.0|5\.1|7\.1)\b/g,
    language: /\b(MULTi|FRENCH|VOF|VOSTFR|SUBFRENCH|TRUEFRENCH|VFF|VFQ|VFi)\b/gi,
    hdr: /\b(HDR(?:10\+?)?|DV|HLG|Dolby\s?Vision)\b/gi,
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

  // 2. Resolution
  const resMatch = findMatch(patterns.resolution, 'resolution');
  if (resMatch) info.resolution = resMatch[0].toLowerCase();

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

  // 5. Codec
  const codecMatch = findMatch(patterns.codec, 'codec');
  if (codecMatch) {
      let c = codecMatch[0].toLowerCase();
      // Normalize
      if (c === 'h.264') c = 'h264';
      if (c === 'h.265') c = 'h265';
      if (c === 'mpeg2') c = 'mpeg';
      info.codec = c;
  }

  // 6. Audio
  const audioMatch = findMatch(patterns.audio, 'audio');
  if (audioMatch) info.audio = audioMatch[0];

  // 7. Channels
  const chMatch = findMatch(patterns.audioChannels, 'audioChannels');
  if (chMatch) info.audioChannels = chMatch[0];

  // 8. Language
  const langMatch = findMatch(patterns.language, 'language');
  if (langMatch) info.language = langMatch[0].toUpperCase();

  // 9. HDR - can be multiple
  const hdrMatches = cleanName.match(patterns.hdr);
  if (hdrMatches) {
    // Update firstTagIndex if the first match is earlier
    // match() returns array of strings, we need to find index manually if we strictly assume title is before *everything*
    // but usually HDR tags come after resolution/year. 
    // To be safe, let's just loop matches to find min index
    let regex = new RegExp(patterns.hdr);
    let m;
    while ((m = regex.exec(cleanName)) !== null) {
        if (m.index < firstTagIndex) firstTagIndex = m.index;
    }
    info.hdr = hdrMatches.map(h => h.toUpperCase());
  }

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
  }

  return info;
}
