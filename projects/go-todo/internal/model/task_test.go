package model

import (
	"encoding/json"
	"testing"
)

func TestPriorityValues(t *testing.T) {
	tests := []struct {
		name  string
		value Priority
		want  int
	}{
		{"PriorityLow is 0", PriorityLow, 0},
		{"PriorityMedium is 1", PriorityMedium, 1},
		{"PriorityHigh is 2", PriorityHigh, 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if int(tt.value) != tt.want {
				t.Errorf("got %d, want %d", int(tt.value), tt.want)
			}
		})
	}
}

func TestStatusValues(t *testing.T) {
	tests := []struct {
		name  string
		value Status
		want  int
	}{
		{"StatusPending is 0", StatusPending, 0},
		{"StatusDone is 1", StatusDone, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if int(tt.value) != tt.want {
				t.Errorf("got %d, want %d", int(tt.value), tt.want)
			}
		})
	}
}

func TestTaskZeroValue(t *testing.T) {
	var task Task
	if task.Status != StatusPending {
		t.Errorf("zero value Status = %d, want StatusPending (%d)", task.Status, StatusPending)
	}
	if task.Priority != PriorityLow {
		t.Errorf("zero value Priority = %d, want PriorityLow (%d)", task.Priority, PriorityLow)
	}
}

func TestTaskJSONRoundTrip(t *testing.T) {
	task := Task{
		ID:        "1",
		Text:      "test task",
		Priority:  PriorityHigh,
		Status:    StatusDone,
		CreatedAt: "2026-01-01T00:00:00Z",
		DoneAt:    "2026-01-02T00:00:00Z",
	}
	data, err := json.Marshal(task)
	if err != nil {
		t.Fatal(err)
	}
	var got Task
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != task.ID {
		t.Errorf("ID: got %q, want %q", got.ID, task.ID)
	}
	if got.Text != task.Text {
		t.Errorf("Text: got %q, want %q", got.Text, task.Text)
	}
	if got.Priority != task.Priority {
		t.Errorf("Priority: got %d, want %d", got.Priority, task.Priority)
	}
	if got.Status != task.Status {
		t.Errorf("Status: got %d, want %d", got.Status, task.Status)
	}
}

func TestTaskJSONOmitEmpty(t *testing.T) {
	task := Task{
		ID:        "2",
		Text:      "no optional fields",
		Priority:  PriorityLow,
		Status:    StatusPending,
		CreatedAt: "2026-01-01T00:00:00Z",
	}
	data, err := json.Marshal(task)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if _, ok := result["due"]; ok {
		t.Error("due field should be omitted when empty")
	}
	if _, ok := result["done_at"]; ok {
		t.Error("done_at field should be omitted when empty")
	}
}
