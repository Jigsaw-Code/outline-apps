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
	"math/rand"
	"net"
	"sync"

	"github.com/eycorsican/go-tun2socks/common/log"
)

// IPMap maps hostnames to IPSets.
type IPMap interface {
	// Get creates an IPSet for this hostname populated with the IPs
	// discovered by resolving it.  Subsequent calls to Get return the
	// same IPSet.
	Get(hostname string) *IPSet
}

// NewIPMap returns a fresh IPMap.
// `r` will be used to resolve any hostnames passed to `Get` or `Add`.
func NewIPMap(r *net.Resolver) IPMap {
	return &ipMap{
		m: make(map[string]*IPSet),
		r: r,
	}
}

type ipMap struct {
	sync.RWMutex
	m map[string]*IPSet
	r *net.Resolver
}

func (m *ipMap) Get(hostname string) *IPSet {
	m.RLock()
	s := m.m[hostname]
	m.RUnlock()
	if s != nil {
		return s
	}

	s = &IPSet{r: m.r}
	s.Add(hostname)

	m.Lock()
	s2 := m.m[hostname]
	if s2 == nil {
		m.m[hostname] = s
	} else {
		// Another pending call to Get populated m[hostname]
		// while we were building s.  Use that one to ensure
		// consistency.
		s = s2
	}
	m.Unlock()

	return s
}

// IPSet represents an unordered collection of IP addresses for a single host.
// One IP can be marked as confirmed to be working correctly.
type IPSet struct {
	sync.RWMutex
	ips       []net.IP      // All known IPs for the server.
	confirmed net.IP        // IP address confirmed to be working
	r         *net.Resolver // Resolver to use for hostname resolution
}

// Reports whether ip is in the set.  Must be called under RLock.
func (s *IPSet) has(ip net.IP) bool {
	for _, oldIP := range s.ips {
		if oldIP.Equal(ip) {
			return true
		}
	}
	return false
}

// Adds an IP to the set if it is not present.  Must be called under Lock.
func (s *IPSet) add(ip net.IP) {
	if !s.has(ip) {
		s.ips = append(s.ips, ip)
	}
}

// Add one or more IP addresses to the set.
// The hostname can be a domain name or an IP address.
func (s *IPSet) Add(hostname string) {
	// Don't hold the ipMap lock during blocking I/O.
	resolved, err := s.r.LookupIPAddr(context.TODO(), hostname)
	if err != nil {
		log.Warnf("Failed to resolve %s: %v", hostname, err)
	}
	s.Lock()
	for _, addr := range resolved {
		s.add(addr.IP)
	}
	s.Unlock()
}

// Empty reports whether the set is empty.
func (s *IPSet) Empty() bool {
	s.RLock()
	defer s.RUnlock()
	return len(s.ips) == 0
}

// GetAll returns a copy of the IP set as a slice in random order.
// The slice is owned by the caller, but the elements are owned by the set.
func (s *IPSet) GetAll() []net.IP {
	s.RLock()
	c := append([]net.IP{}, s.ips...)
	s.RUnlock()
	rand.Shuffle(len(c), func(i, j int) {
		c[i], c[j] = c[j], c[i]
	})
	return c
}

// Confirmed returns the confirmed IP address, or nil if there is no such address.
func (s *IPSet) Confirmed() net.IP {
	s.RLock()
	defer s.RUnlock()
	return s.confirmed
}

// Confirm marks ip as the confirmed address.
func (s *IPSet) Confirm(ip net.IP) {
	// Optimization: Skip setting if it hasn't changed.
	if ip.Equal(s.Confirmed()) {
		// This is the common case.
		return
	}
	s.Lock()
	// Add is O(N)
	s.add(ip)
	s.confirmed = ip
	s.Unlock()
}

// Disconfirm sets the confirmed address to nil if the current confirmed address
// is the provided ip.
func (s *IPSet) Disconfirm(ip net.IP) {
	s.Lock()
	if ip.Equal(s.confirmed) {
		s.confirmed = nil
	}
	s.Unlock()
}
