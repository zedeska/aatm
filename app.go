package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	rt "runtime"
	"strings"

	"github.com/anacrolix/torrent/bencode"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileInfo struct to hold file details
type FileInfo struct {
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	IsDir       bool   `json:"isDir"`
	IsProcessed bool   `json:"isProcessed"`
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	InitDB()
}

// SelectDirectory opens a directory selection dialog
func (a *App) SelectDirectory() string {
	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Directory",
	})
	if err != nil {
		return ""
	}
	return selection
}

// ListDirectory returns the contents of the given directory
func (a *App) ListDirectory(path string) ([]FileInfo, error) {
	if path == "" {
		return []FileInfo{}, nil
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	files := []FileInfo{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		isProc := isProcessed(fullPath)

		if entry.IsDir() {
			// Check if directory contains at least one video file
			subEntries, err := os.ReadDir(fullPath)
			if err == nil {
				hasVideo := false
				for _, sub := range subEntries {
					if !sub.IsDir() {
						ext := strings.ToLower(filepath.Ext(sub.Name()))
						if ext == ".mkv" || ext == ".mp4" {
							hasVideo = true
							break
						}
					}
				}
				if hasVideo {
					files = append(files, FileInfo{
						Name:        entry.Name(),
						Size:        info.Size(),
						IsDir:       true,
						IsProcessed: isProc,
					})
				}
			}
		} else {
			// Check file extension
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if ext == ".mkv" || ext == ".mp4" {
				files = append(files, FileInfo{
					Name:        entry.Name(),
					Size:        info.Size(),
					IsDir:       false,
					IsProcessed: isProc,
				})
			}
		}
	}
	return files, nil
}

// GetMediaInfo executes mediainfo command on the file and returns output
func (a *App) GetMediaInfo(filePath string) (string, error) {
	// Check if mediainfo is in PATH
	path, err := exec.LookPath("mediainfo")
	if err != nil {
		return "", err
	}

	cmd := exec.Command(path, filePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

// CreateTorrent creates a .torrent file for the given source path
func (a *App) CreateTorrent(sourcePath string, trackers []string, comment string, isPrivate bool) (string, error) {
	info := metainfo.Info{
		PieceLength: 256 * 1024,
	}

	if isPrivate {
		info.Private = new(bool)
		*info.Private = true
	}

	err := info.BuildFromFilePath(sourcePath)
	if err != nil {
		return "", err
	}

	mi := metainfo.MetaInfo{
		AnnounceList: func() [][]string {
			var list [][]string
			for _, url := range trackers {
				if strings.TrimSpace(url) != "" {
					list = append(list, []string{url})
				}
			}
			return list
		}(),
		Comment:   comment,
		CreatedBy: "AATM",
	}
	mi.SetDefaults()

	infoBytes, err := bencode.Marshal(info)
	if err != nil {
		return "", err
	}
	mi.InfoBytes = infoBytes

	outputPath := sourcePath + ".torrent"
	outFile, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer outFile.Close()

	err = mi.Write(outFile)
	if err != nil {
		return "", err
	}

	return outputPath, nil
}

// OpenFileLocation opens the file explorer at the given path
func (a *App) OpenFileLocation(path string) error {
	if path == "" {
		return nil
	}

	// Ensure path uses OS separators
	path = filepath.Clean(path)

	var cmd *exec.Cmd

	switch rt.GOOS {
	case "windows":
		// On Windows: explorer /select,path
		cmd = exec.Command("explorer", "/select,", path)
	case "darwin":
		// On macOS: open -R path
		cmd = exec.Command("open", "-R", path)
	case "linux":
		// On Linux: xdg-open (directory) using dbus or file manager
		// xdg-open doesn't support selecting a file in a folder easily across all DMs.
		// Often just opening the folder is the safest bet.
		dir := filepath.Dir(path)
		if fi, err := os.Stat(path); err == nil && fi.IsDir() {
			dir = path
		}
		cmd = exec.Command("xdg-open", dir)
	default:
		// Fallback to opening the directory
		dir := filepath.Dir(path)
		cmd = exec.Command("xdg-open", dir)
	}

	return cmd.Start()
}

// SaveNfo saves the NFO content to a file derived from the source path
func (a *App) SaveNfo(sourcePath string, content string) (string, error) {
	// Determine output path logic: usually adjacent to source, same basename
	outputPath := sourcePath
	ext := filepath.Ext(sourcePath)
	// If it's a known video container, strip extension to place NFO "next" to it with same name
	lowerExt := strings.ToLower(ext)
	if lowerExt == ".mkv" || lowerExt == ".mp4" || lowerExt == ".avi" {
		outputPath = strings.TrimSuffix(sourcePath, ext)
	}
	outputPath += ".nfo"

	err := os.WriteFile(outputPath, []byte(content), 0644)
	if err != nil {
		return "", err
	}
	return outputPath, nil
}

// DeleteFile deletes the specified file
func (a *App) DeleteFile(path string) error {
	if path == "" {
		return nil
	}
	return os.Remove(path)
}

// GetDirectorySize calculates the total size of a directory recursively
func (a *App) GetDirectorySize(path string) (string, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return formatSize(size), nil
}

func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	// Use explicit precision logic? Or just %.1f
	// example: 14.5 GiB
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
