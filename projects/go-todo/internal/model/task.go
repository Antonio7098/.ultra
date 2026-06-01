package model

type Priority int

const (
	PriorityLow Priority = iota
	PriorityMedium
	PriorityHigh
)

type Status int

const (
	StatusPending Status = iota
	StatusDone
)

type Task struct {
	ID        string   `json:"id"`
	Text      string   `json:"text"`
	Priority  Priority `json:"priority"`
	Status    Status   `json:"status"`
	Due       string   `json:"due,omitempty"`
	CreatedAt string   `json:"created_at"`
	DoneAt    string   `json:"done_at,omitempty"`
}
