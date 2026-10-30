package busy

import "testing"

func TestBusyWhileOperationsRun(t *testing.T) {
	var tr Tracker
	if tr.Busy() {
		t.Fatal("new tracker should not be busy")
	}
	a := tr.Begin()
	b := tr.Begin()
	if !tr.Busy() {
		t.Fatal("expected busy")
	}
	a()
	if !tr.Busy() {
		t.Fatal("still one operation running")
	}
	b()
	if tr.Busy() {
		t.Fatal("expected idle")
	}
}

func TestDoneIsSafeToCallTwice(t *testing.T) {
	var tr Tracker
	a := tr.Begin()
	b := tr.Begin()
	a()
	a() // must not steal b's count
	if !tr.Busy() {
		t.Fatal("double done released someone else's operation")
	}
	b()
}
