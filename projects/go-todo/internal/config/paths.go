package config

import (
	"os"
	"path/filepath"
)

func ConfigDir() string {
	return filepath.Join(os.Getenv("HOME"), ".config", "go-todo")
}
