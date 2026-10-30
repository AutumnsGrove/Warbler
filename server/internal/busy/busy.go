// Package busy tracks work that must not be interrupted by an update, such as
// a session upload in progress. The host update watcher asks /api/busy and
// waits briefly while it is true.
package busy

import "sync/atomic"

// Tracker counts operations in flight. The zero value is ready to use.
type Tracker struct{ n atomic.Int64 }

// Begin marks one operation as started and returns the function that ends it.
// Call the returned function exactly once, usually with defer.
func (t *Tracker) Begin() (done func()) {
	t.n.Add(1)
	var ended atomic.Bool
	return func() {
		if ended.CompareAndSwap(false, true) {
			t.n.Add(-1)
		}
	}
}

// Busy reports whether any operation is in flight.
func (t *Tracker) Busy() bool { return t.n.Load() > 0 }
