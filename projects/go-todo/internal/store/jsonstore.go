package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/antonioborgerees/go-todo/internal/model"
)

type JSONStore struct {
	filePath string
}

func NewJSONStore(path string) *JSONStore {
	return &JSONStore{filePath: path}
}

func (s *JSONStore) Add(task model.Task) (model.Task, error) {
	if task.ID == "" {
		return model.Task{}, ErrTaskIDEmpty
	}

	tasks, err := s.readTasks()
	if err != nil {
		return model.Task{}, fmt.Errorf("add task: %w", err)
	}

	tasks = append(tasks, task)
	if err := s.writeTasks(tasks); err != nil {
		return model.Task{}, fmt.Errorf("add task: %w", err)
	}

	return task, nil
}

func (s *JSONStore) List() ([]model.Task, error) {
	tasks, err := s.readTasks()
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	return tasks, nil
}

func (s *JSONStore) Done(id string) (model.Task, error) {
	if id == "" {
		return model.Task{}, ErrTaskIDEmpty
	}

	tasks, err := s.readTasks()
	if err != nil {
		return model.Task{}, fmt.Errorf("done task: %w", err)
	}

	for i, t := range tasks {
		if t.ID == id {
			tasks[i].Status = model.StatusDone
			if err := s.writeTasks(tasks); err != nil {
				return model.Task{}, fmt.Errorf("done task: %w", err)
			}
			return tasks[i], nil
		}
	}

	return model.Task{}, fmt.Errorf("done task: %w", ErrTaskNotFound)
}

func (s *JSONStore) Remove(id string) error {
	if id == "" {
		return ErrTaskIDEmpty
	}

	tasks, err := s.readTasks()
	if err != nil {
		return fmt.Errorf("remove task: %w", err)
	}

	found := false
	var filtered []model.Task
	for _, t := range tasks {
		if t.ID == id {
			found = true
			continue
		}
		filtered = append(filtered, t)
	}

	if !found {
		return fmt.Errorf("remove task: %w", ErrTaskNotFound)
	}

	if err := s.writeTasks(filtered); err != nil {
		return fmt.Errorf("remove task: %w", err)
	}

	return nil
}

func (s *JSONStore) readTasks() ([]model.Task, error) {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.Task{}, nil
		}
		return nil, fmt.Errorf("read tasks: %w", err)
	}

	var tasks []model.Task
	if err := json.Unmarshal(data, &tasks); err != nil {
		return nil, fmt.Errorf("read tasks: %w", err)
	}

	return tasks, nil
}

func (s *JSONStore) writeTasks(tasks []model.Task) error {
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("write tasks: %w", err)
	}

	tmp, err := os.CreateTemp(dir, "tasks-*.tmp")
	if err != nil {
		return fmt.Errorf("write tasks: %w", err)
	}
	tmpPath := tmp.Name()

	if err := json.NewEncoder(tmp).Encode(tasks); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("write tasks: %w", err)
	}

	if err := tmp.Close(); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("write tasks: %w", err)
	}

	if err := os.Rename(tmpPath, s.filePath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("write tasks: %w", err)
	}

	return nil
}
