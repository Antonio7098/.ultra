package main

import (
	"os"
	"path/filepath"

	"github.com/antonioborgerees/go-todo/internal/config"
	"github.com/antonioborgerees/go-todo/internal/store"
	"github.com/urfave/cli/v2"
)

func main() {
	configDir := config.ConfigDir()
	storePath := filepath.Join(configDir, "tasks.json")
	store.NewJSONStore(storePath)

	app := &cli.App{
		Name:    "todo",
		Usage:   "A minimal todo-list CLI",
		Version: "0.1.0",
	}

	app.Run(os.Args)
}
