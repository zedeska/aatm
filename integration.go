package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
)

// ReleaseInfo matches the typescript interface
type ReleaseInfo struct {
	Title         string   `json:"title"`
	Year          string   `json:"year"`
	Season        string   `json:"season"`
	Episode       string   `json:"episode"`
	Resolution    string   `json:"resolution"`
	Source        string   `json:"source"`
	Codec         string   `json:"codec"`
	Audio         string   `json:"audio"`
	AudioChannels string   `json:"audioChannels"`
	Language      string   `json:"language"`
	Hdr           []string `json:"hdr"`
	ReleaseGroup  string   `json:"releaseGroup"`
}

// Meta structures for La Cale API
type Tag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type TagGroup struct {
	Tags []Tag `json:"tags"`
}

type Category struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	Slug     string     `json:"slug"`
	Children []Category `json:"children"`
}

type MetaResponse struct {
	Categories    []Category `json:"categories"`
	TagGroups     []TagGroup `json:"tagGroups"`
	UngroupedTags []Tag      `json:"ungroupedTags"`
}

// UploadToQBittorrent uploads the .torrent file to the configured qBittorrent instance
func (a *App) UploadToQBittorrent(torrentPath string, qbitUrl string, username string, password string) error {
	if qbitUrl == "" {
		return fmt.Errorf("qBittorrent URL is not configured")
	}

	// Remove trailing slash
	qbitUrl = strings.TrimSuffix(qbitUrl, "/")

	jar, err := cookiejar.New(nil)
	if err != nil {
		return err
	}
	client := &http.Client{Jar: jar}

	// 1. Login
	if username != "" || password != "" {
		vals := url.Values{}
		vals.Set("username", username)
		vals.Set("password", password)
		resp, err := client.PostForm(qbitUrl+"/api/v2/auth/login", vals)
		if err != nil {
			return fmt.Errorf("failed to login to qBittorrent: %w", err)
		}
		defer resp.Body.Close()

		// Some qbit versions return 200 even on failure with "Fails." in body
		body, _ := io.ReadAll(resp.Body)
		if string(body) == "Fails." {
			return fmt.Errorf("qBittorrent login failed: invalid credentials")
		}
		if resp.StatusCode != 200 {
			return fmt.Errorf("qBittorrent login failed: status %d", resp.StatusCode)
		}
	}

	// 2. Add Torrent
	// Prepare multipart
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file
	file, err := os.Open(torrentPath)
	if err != nil {
		return err
	}
	defer file.Close()

	part, err := writer.CreateFormFile("torrents", "release.torrent")
	if err != nil {
		return err
	}
	_, err = io.Copy(part, file)
	if err != nil {
		return err
	}

	writer.Close()

	req, err := http.NewRequest("POST", qbitUrl+"/api/v2/torrents/add", body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to add torrent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("failed to add torrent, status: %d", resp.StatusCode)
	}

	return nil
}

// UploadToLaCale uploads the release metadata and files to la-cale.space
func (a *App) UploadToLaCale(torrentPath string, nfoPath string, title string, description string, tmdbId string, mediaType string, releaseInfo ReleaseInfo, passkey string) error {
	if passkey == "" {
		return fmt.Errorf("passkey is missing in settings")
	}

	baseURL := "https://la-cale.space/api/external"

	// 1. Fetch Metadata (Categories & Tags)
	metaResp, err := http.Get(fmt.Sprintf("%s/meta?passkey=%s", baseURL, passkey))
	if err != nil {
		return fmt.Errorf("failed to fetch metadata: %w", err)
	}
	defer metaResp.Body.Close()

	if metaResp.StatusCode != 200 {
		return fmt.Errorf("failed to fetch metadata, status: %d", metaResp.StatusCode)
	}

	var meta MetaResponse
	if err := json.NewDecoder(metaResp.Body).Decode(&meta); err != nil {
		return fmt.Errorf("failed to decode metadata: %w", err)
	}

	// 2. Identify Category
	categoryId := findCategoryId(meta.Categories, mediaType)
	if categoryId == "" {
		return fmt.Errorf("could not find a matching category for type: %s", mediaType)
	}

	// 3. Identify Tags
	matchedTags := findMatchingTags(meta, releaseInfo)

	// 4. Upload
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Fields
	writer.WriteField("passkey", passkey)
	writer.WriteField("title", title)
	writer.WriteField("description", description)
	writer.WriteField("categoryId", categoryId)
	writer.WriteField("isAnonymous", "false")
	if tmdbId != "" {
		writer.WriteField("tmdbId", tmdbId)
		// Map simple mediaType to likely tmdb type
		tmdbType := "MOVIE"
		if mediaType == "episode" || mediaType == "season" {
			tmdbType = "TV" 
		}
		writer.WriteField("tmdbType", tmdbType)
	}

	for _, tag := range matchedTags {
		writer.WriteField("tags", tag)
	}

	tFile, err := os.Open(torrentPath)
	if err != nil {
		return err
	}
	defer tFile.Close()
	
    // Create Torrent Part custom
    h := make(map[string][]string)
    h["Content-Disposition"] = []string{fmt.Sprintf(`form-data; name="file"; filename="%s.torrent"`, title)}
    h["Content-Type"] = []string{"application/x-bittorrent"}
	tPart, err := writer.CreatePart(h)
	if err != nil {
		return err
	}
	io.Copy(tPart, tFile)

	// NFO
	nFile, err := os.Open(nfoPath)
	if err != nil {
		return err
	}
	defer nFile.Close()
	
    // Create NFO Part custom
    hNfo := make(map[string][]string)
    hNfo["Content-Disposition"] = []string{fmt.Sprintf(`form-data; name="nfoFile"; filename="%s.nfo"`, title)}
    hNfo["Content-Type"] = []string{"text/x-nfo"}
	nPart, err := writer.CreatePart(hNfo)
	if err != nil {
		return err
	}
	io.Copy(nPart, nFile)

	writer.Close()
    
    // Debug Print (Truncated for sanity, but enough to see structure)
    fmt.Printf("--- Payload Preview (First 2000 chars) ---\n%s\n--- End Preview ---\n", string(body.Bytes()[:min(2000, body.Len())]))

	req, err := http.NewRequest("POST", baseURL+"/upload", body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("upload request failed: %w", err)
	}
	defer uploadResp.Body.Close()

	if uploadResp.StatusCode != 200 {
		respBody, err := io.ReadAll(uploadResp.Body)
		if err != nil {
			return fmt.Errorf("API Error (Status %d) - Failed to read body: %v", uploadResp.StatusCode, err)
		}
		return fmt.Errorf("API Error (Status %d) | Response: %s", uploadResp.StatusCode, string(respBody))
	}

	return nil
}

// Helpers

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}

func findCategoryId(categories []Category, mediaType string) string {
	// Recursive search for keywords
	// mediaType: "movie", "episode", "season"

	keywords := []string{}
	if mediaType == "movie" {
		keywords = []string{"film", "movie"}
	} else {
		keywords = []string{"serie", "série", "show", "season", "episode"}
	}

	for _, cat := range categories {
		// Check children first (more specific)
		if len(cat.Children) > 0 {
			if id := findCategoryId(cat.Children, mediaType); id != "" {
				return id
			}
		}
		// Check self
		lowerSlug := strings.ToLower(cat.Slug)
		for _, kw := range keywords {
			if strings.Contains(lowerSlug, kw) {
				return cat.ID
			}
		}
	}
	return ""
}

func findMatchingTags(meta MetaResponse, info ReleaseInfo) []string {
	// Gather all available tags into a map for easy lookup by slug
	availableTags := make(map[string]string) // lowercase slug -> ID

	collectTags := func(tags []Tag) {
		for _, t := range tags {
			availableTags[strings.ToLower(t.Slug)] = t.ID
		}
	}

	collectTags(meta.UngroupedTags)
	for _, g := range meta.TagGroups {
		collectTags(g.Tags)
	}

	matched := []string{}

	// Helper to check and add
	check := func(val string) {
		val = strings.ToLower(val)
		if slug, ok := availableTags[val]; ok {
			matched = append(matched, slug)
		} else {
			// Try fuzzy? e.g. "h.264" vs "h264".
			// For now, strict match based on parser output vs api slugs.
			// Common replacements
			valClean := strings.ReplaceAll(val, ".", "")
			if slug, ok := availableTags[valClean]; ok {
				matched = append(matched, slug)
			}
			valDash := strings.ReplaceAll(val, " ", "-")
			if slug, ok := availableTags[valDash]; ok {
				matched = append(matched, slug)
			}
		}
	}

	if info.Resolution != "" {
		check(info.Resolution)
	}
	if info.Source != "" {
		check(info.Source)
	}
	if info.Codec != "" {
		check(info.Codec)
	}
	if info.Audio != "" {
		check(info.Audio)
	}
	if info.Language != "" {
		// Parser returns "FRENCH", slug likely "french" or "vff"
		// If parser says "MULTI", check multi.
		check(info.Language)
	}
	for _, h := range info.Hdr {
		check(h)
	}

	return matched
}
