package store

import "errors"

var ErrTaskNotFound = errors.New("task not found")
var ErrTaskIDEmpty = errors.New("task ID cannot be empty")
