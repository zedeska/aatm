import type { ReleaseInfo } from "./parser";

const TMDB_API_KEY = "49d8d37e45764e7c6794ed7dd2d896d4";

interface PresentationData {
    releaseInfo: ReleaseInfo;
    tmdbId: string;
    mediaType: 'movie' | 'episode' | 'season';
    nfoContent: string;
    totalSize?: string;
}

export async function generatePresentation(data: PresentationData): Promise<string> {
    const { tmdbId, mediaType, releaseInfo, nfoContent, totalSize } = data;
    
    // 1. Fetch TMDB Details
    const type = (mediaType === 'movie') ? 'movie' : 'tv';
    let tmdbData: any = {};
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        tmdbData = await res.json();
    } catch (e) {
        console.error("Failed to fetch TMDB details for presentation:", e);
        // Fallback?
    }
    
    // Extract TMDB fields
    const title = tmdbData.title || tmdbData.name || releaseInfo.title || "Unknown Title";
    const year = (tmdbData.release_date || tmdbData.first_air_date || "").substring(0, 4) || releaseInfo.year || "";
    const posterUrl = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "";
    const genres = (tmdbData.genres || []).map((g: any) => g.name).slice(0, 3).join(", ");
    const score = tmdbData.vote_average ? `⭐ ${tmdbData.vote_average.toFixed(1)}/10` : "";
    const overview = tmdbData.overview || "Aucune description disponible.";
    
    // 2. Parse Technical Details from NFO
    // Size
    let size = "N/A";
    
    if (totalSize) {
        size = totalSize;
    } else {
        const sizeMatch = nfoContent.match(/File\s*size\s*:\s*([0-9.]+\s*[KMGT]?i?B)/i);
        if (sizeMatch) {
            size = sizeMatch[1];
        }
    }
    
    // Subs
    let subs = "Aucun";
    // Checks for Text streams
    if (nfoContent.match(/(?:Text|Subtitle)\s*#\d+/i) || nfoContent.match(/Format\s*:\s*UTF-8/i) || nfoContent.match(/Format\s*:\s*PGS/i) || nfoContent.match(/Format\s*:\s*VobSub/i)) {
         // Simple heuristic for french
         if (nfoContent.match(/(?:Language|Language\s*:\s*French)/i)) {
             subs = "Français (Inclus)";
         } else {
             subs = "Inclus";
         }
    }
    
    // Format (Container)
    let format = "MKV"; // Default usually
    if (nfoContent.match(/Format\s*:\s*MPEG-4/i)) format = "MP4";
    else if (nfoContent.match(/Format\s*:\s*AVI/i)) format = "AVI";
    
    // Data preparation
    const resolution = releaseInfo.resolution || (nfoContent.includes('Height') ? 'Unknown' : 'Unknown'); // Logic in parser.ts usually handles this
    const video = releaseInfo.codec || "Unknown";
    const audio = releaseInfo.audio || "Unknown";
    const source = releaseInfo.source || "Unknown";
    
    // Detailed Languages
    let language = releaseInfo.language || "Unknown"; 
    if (releaseInfo.audioLanguages && releaseInfo.audioLanguages.length > 0) {
        language = releaseInfo.audioLanguages.join(", ");
    }

    // Detailed Subtitles
    if (releaseInfo.subtitleLanguages && releaseInfo.subtitleLanguages.length > 0) {
        subs = releaseInfo.subtitleLanguages.join(", ");
    } else if (subs === "Aucun" && (nfoContent.match(/(?:Text|Subtitle)\s*#\d+/i))) {
        // Fallback to heuristic if array is empty but subtitles detected
        if (nfoContent.match(/(?:Language|Language\s*:\s*French)/i)) {
             subs = "Français (Inclus)";
         } else {
             subs = "Inclus";
         }
    }
    
    // Build HTML
    return `
    <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; background-color: #121212; color: #e0e0e0; padding: 20px; border-radius: 8px; border: 1px solid #333;">
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex-shrink: 0; width: 100%; max-width: 250px; margin: 0 auto;">
          ${posterUrl ? `<img src="${posterUrl}" alt="${title}" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);" />` : '<div style="width: 100%; height: 350px; background: #333; display: flex; items-center: center; justify-content: center;">No Image</div>'}
        </div>
        <div style="flex: 1; min-width: 300px;">
          <h1 style="color: #eab308; margin-top: 0; font-family: 'Cinzel', serif; text-transform: uppercase;">${title} <span style="font-size: 0.6em; color: #888;">(${year})</span></h1>
          
          <div style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 10px;">
            ${resolution ? `<span style="background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; text-transform: uppercase;">${resolution}</span>` : ''}
            ${genres ? `<span style="background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${genres}</span>` : ''}
            ${score ? `<span style="background: #333; padding: 4px 8px; border-radius: 4px; font-size: 0.8em;">${score}</span>` : ''}
          </div>

          <p style="font-style: italic; color: #aaa; border-left: 3px solid #eab308; padding-left: 10px;">${overview}</p>
          
          
        <div style="margin-top: 20px;">
            <h3 style="color: #eab308; border-bottom: 1px solid #333; padding-bottom: 5px;">Informations Techniques</h3>
            <ul style="list-style: none; padding: 0; font-size: 0.9em; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
              <li><strong>Format :</strong> ${format}</li>
              <li><strong>Source :</strong> ${source}</li>
              <li><strong>Vidéo :</strong> ${video.toUpperCase()}</li>
              <li><strong>Audio :</strong> ${audio.toUpperCase()}</li>
              <li><strong>Langues :</strong> ${language}</li>
              <li><strong>Sous-titres :</strong> ${subs}</li>
              <li><strong>Taille :</strong> ${size}</li>
            </ul>
        </div>
      
        </div>
      </div>
      
    </div>
    `;
}
