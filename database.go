package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var db *sql.DB

// AppSettings defines the structure of the settings to be saved
type AppSettings struct {
	TorrentTrackers  string `json:"torrentTrackers"`
	IsPrivateTorrent bool   `json:"isPrivateTorrent"`
	Passkey          string `json:"passkey"`
	QbitUrl          string `json:"qbitUrl"`
	QbitUsername     string `json:"qbitUsername"`
	QbitPassword     string `json:"qbitPassword"`
}

// InitDB initializes the SQLite database
func InitDB() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		log.Fatal(err)
	}
	appDir := filepath.Join(configDir, "aatm")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		log.Fatal(err)
	}
	dbPath := filepath.Join(appDir, "data.db")

	var errOpen error
	db, errOpen = sql.Open("sqlite", dbPath)
	if errOpen != nil {
		log.Fatal(errOpen)
	}

	createTables()
}

func createTables() {
	query := `
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT
    );
    CREATE TABLE IF NOT EXISTS processed_files (
        path TEXT PRIMARY KEY,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `
	_, err := db.Exec(query)
	if err != nil {
		log.Fatal(err)
	}
}

// SaveSettings saves the application settings to the database
func (a *App) SaveSettings(settings AppSettings) error {
	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	_, err = db.Exec("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)", string(data))
	return err
}

// GetSettings retrieves the application settings from the database
func (a *App) GetSettings() AppSettings {
	var data string
	err := db.QueryRow("SELECT data FROM settings WHERE id = 1").Scan(&data)
	if err != nil {
		return AppSettings{}
	}
	var settings AppSettings
	json.Unmarshal([]byte(data), &settings)
	return settings
}

// MarkProcessed marks a file as processed in the database
func (a *App) MarkProcessed(path string) error {
	_, err := db.Exec("INSERT OR IGNORE INTO processed_files (path) VALUES (?)", path)
	return err
}

// ClearProcessedFiles removes all records from the processed_files table
func (a *App) ClearProcessedFiles() error {
	_, err := db.Exec("DELETE FROM processed_files")
	return err
}

// isProcessed checks if a file has explicitly been marked as processed
func isProcessed(path string) bool {
	if db == nil {
		return false
	}
	var exists int
	err := db.QueryRow("SELECT 1 FROM processed_files WHERE path = ?", path).Scan(&exists)
	return err == nil
}
