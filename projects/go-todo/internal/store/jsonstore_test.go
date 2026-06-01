package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/antonioborgerees/go-todo/internal/model"
)

func newTestStore(t *testing.T) (*JSONStore, string) {
	t.Helper()
	dir, err := os.MkdirTemp("", "go-todo-store-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	path := filepath.Join(dir, "tasks.json")
	return NewJSONStore(path), path
}

func TestAdd(t *testing.T) {
	s, _ := newTestStore(t)
	task := model.Task{
		ID:        "1",
		Text:      "test task",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	got, err := s.Add(task)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != task.ID {
		t.Errorf("got ID %q, want %q", got.ID, task.ID)
	}
	tasks, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 {
		t.Fatalf("got %d tasks, want 1", len(tasks))
	}
}

func TestList(t *testing.T) {
	s, _ := newTestStore(t)
	tasks := []model.Task{
		{ID: "1", Text: "first", Priority: model.PriorityLow, Status: model.StatusPending, CreatedAt: "2026-01-01T00:00:00Z"},
		{ID: "2", Text: "second", Priority: model.PriorityMedium, Status: model.StatusPending, CreatedAt: "2026-01-01T00:00:00Z"},
	}
	for _, task := range tasks {
		if _, err := s.Add(task); err != nil {
			t.Fatal(err)
		}
	}
	got, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d tasks, want 2", len(got))
	}
}

func TestDone(t *testing.T) {
	s, _ := newTestStore(t)
	task := model.Task{
		ID:        "1",
		Text:      "complete me",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	if _, err := s.Add(task); err != nil {
		t.Fatal(err)
	}
	got, err := s.Done("1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != model.StatusDone {
		t.Errorf("got Status %d, want %d", got.Status, model.StatusDone)
	}
}

func TestRemove(t *testing.T) {
	s, _ := newTestStore(t)
	task := model.Task{
		ID:        "1",
		Text:      "remove me",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	if _, err := s.Add(task); err != nil {
		t.Fatal(err)
	}
	if err := s.Remove("1"); err != nil {
		t.Fatal(err)
	}
	tasks, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Errorf("got %d tasks, want 0", len(tasks))
	}
}

func TestAtomicWrite(t *testing.T) {
	s, path := newTestStore(t)
	task := model.Task{
		ID:        "1",
		Text:      "atomic",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	if _, err := s.Add(task); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var decoded []model.Task
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if len(decoded) != 1 || decoded[0].ID != "1" {
		t.Errorf("atomic write produced invalid content: %+v", decoded)
	}
}

func TestDoneNotFound(t *testing.T) {
	s, _ := newTestStore(t)
	_, err := s.Done("nonexistent")
	if !errors.Is(err, ErrTaskNotFound) {
		t.Errorf("expected ErrTaskNotFound, got %v", err)
	}
}

func TestRemoveNotFound(t *testing.T) {
	s, _ := newTestStore(t)
	err := s.Remove("nonexistent")
	if !errors.Is(err, ErrTaskNotFound) {
		t.Errorf("expected ErrTaskNotFound, got %v", err)
	}
}

func TestAddEmptyID(t *testing.T) {
	s, _ := newTestStore(t)
	task := model.Task{
		Text:      "no id",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	_, err := s.Add(task)
	if !errors.Is(err, ErrTaskIDEmpty) {
		t.Errorf("expected ErrTaskIDEmpty, got %v", err)
	}
}

func TestCorruptJSON(t *testing.T) {
	s, path := newTestStore(t)
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("not valid json"), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := s.List()
	if err == nil {
		t.Fatal("expected error for corrupt JSON, got nil")
	}
	if errors.Is(err, ErrTaskNotFound) {
		t.Errorf("corrupt JSON should not produce ErrTaskNotFound, got %v", err)
	}
}

func TestPermissionDenied(t *testing.T) {
	dir, err := os.MkdirTemp("", "go-todo-store-perm-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })

	readOnlyDir := filepath.Join(dir, "readonly")
	if err := os.Mkdir(readOnlyDir, 0444); err != nil {
		t.Fatal(err)
	}

	s := NewJSONStore(filepath.Join(readOnlyDir, "tasks.json"))
	task := model.Task{
		ID:        "1",
		Text:      "perm test",
		Priority:  model.PriorityLow,
		Status:    model.StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	_, err = s.Add(task)
	if err == nil {
		t.Fatal("expected permission error, got nil")
	}
}

func TestListEmptyOnFirstRun(t *testing.T) {
	s, _ := newTestStore(t)
	tasks, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected empty list on first run, got %d tasks", len(tasks))
	}
}
