// Copyright 2019 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package ipmap

import (
	"context"
	"errors"
	"net"
	"sync/atomic"
	"testing"
)

// We use '.' at the end to make sure resolution treats it an inexistent root domain.
// It must not resolve to any address.
const invalidDomain = "invaliddomain."

func TestGetTwice(t *testing.T) {
	m := NewIPMap(nil)
	a := m.Get("example")
	b := m.Get("example")
	if a != b {
		t.Error("Matched Get returned different objects")
	}
}

func TestGetInvalid(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get(invalidDomain)
	if !s.Empty() {
		t.Errorf("Invalid name should result in an empty set, got %v", s.ips)
	}
	if len(s.GetAll()) != 0 {
		t.Errorf("Empty set should be empty, got %v", s.GetAll())
	}
}

func TestGetDomain(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get("www.google.com")
	if s.Empty() {
		t.Error("Google lookup failed")
	}
	ips := s.GetAll()
	if len(ips) == 0 {
		t.Fatal("IP set is empty")
	}
	if ips[0] == nil {
		t.Error("nil IP in set")
	}
}

func TestGetIP(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get("192.0.2.1")
	if s.Empty() {
		t.Error("IP parsing failed")
	}
	ips := s.GetAll()
	if len(ips) != 1 {
		t.Errorf("Wrong IP set size %d", len(ips))
	}
	if ips[0].String() != "192.0.2.1" {
		t.Error("Wrong IP")
	}
}

func TestAddDomain(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get(invalidDomain)
	s.Add("www.google.com")
	if s.Empty() {
		t.Error("Google lookup failed")
	}
	ips := s.GetAll()
	if len(ips) == 0 {
		t.Fatal("IP set is empty")
	}
	if ips[0] == nil {
		t.Error("nil IP in set")
	}
}
func TestAddIP(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get(invalidDomain)
	s.Add("192.0.2.1")
	ips := s.GetAll()
	if len(ips) != 1 {
		t.Errorf("Wrong IP set size %d", len(ips))
	}
	if ips[0].String() != "192.0.2.1" {
		t.Error("Wrong IP")
	}
}

func TestConfirmed(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get("www.google.com")
	if s.Confirmed() != nil {
		t.Error("Confirmed should start out nil")
	}

	ips := s.GetAll()
	s.Confirm(ips[0])
	if !ips[0].Equal(s.Confirmed()) {
		t.Error("Confirmation failed")
	}

	s.Disconfirm(ips[0])
	if s.Confirmed() != nil {
		t.Error("Confirmed should now be nil")
	}
}

func TestConfirmNew(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get(invalidDomain)
	s.Add("192.0.2.1")
	// Confirm a new address.
	s.Confirm(net.ParseIP("192.0.2.2"))
	if s.Confirmed() == nil || s.Confirmed().String() != "192.0.2.2" {
		t.Error("Confirmation failed")
	}
	ips := s.GetAll()
	if len(ips) != 2 {
		t.Error("New address not added to the set")
	}
}

func TestDisconfirmMismatch(t *testing.T) {
	m := NewIPMap(nil)
	s := m.Get("www.google.com")
	ips := s.GetAll()
	s.Confirm(ips[0])

	// Make a copy
	otherIP := net.ParseIP(ips[0].String())
	// Alter it
	otherIP[0]++
	// Disconfirm.  This should have no effect because otherIP
	// is not the confirmed IP.
	s.Disconfirm(otherIP)

	if !ips[0].Equal(s.Confirmed()) {
		t.Error("Mismatched disconfirmation")
	}
}

func TestResolver(t *testing.T) {
	var dialCount int32
	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(context context.Context, network, address string) (net.Conn, error) {
			atomic.AddInt32(&dialCount, 1)
			return nil, errors.New("Fake dialer")
		},
	}
	m := NewIPMap(resolver)
	s := m.Get("www.google.com")
	if !s.Empty() {
		t.Error("Google lookup should have failed due to fake dialer")
	}
	if atomic.LoadInt32(&dialCount) == 0 {
		t.Error("Fake dialer didn't run")
	}
}
