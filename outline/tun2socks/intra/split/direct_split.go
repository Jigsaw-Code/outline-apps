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

package split

import (
	"io"
	"net"
)

// DuplexConn represents a bidirectional stream socket.
type DuplexConn interface {
	net.Conn
	io.ReaderFrom
	CloseWrite() error
	CloseRead() error
}

type splitter struct {
	*net.TCPConn
	used bool // Initially false.  Becomes true after the first write.
}

// DialWithSplit returns a TCP connection that always splits the initial upstream segment.
// Like net.Conn, it is intended for two-threaded use, with one thread calling
// Read and CloseRead, and another calling Write, ReadFrom, and CloseWrite.
func DialWithSplit(d *net.Dialer, addr *net.TCPAddr) (DuplexConn, error) {
	conn, err := d.Dial(addr.Network(), addr.String())
	if err != nil {
		return nil, err
	}

	return &splitter{TCPConn: conn.(*net.TCPConn)}, nil
}

// Write-related functions
func (s *splitter) Write(b []byte) (int, error) {
	conn := s.TCPConn
	if s.used {
		// After the first write, there is no special write behavior.
		return conn.Write(b)
	}

	// Setting `used` to true ensures that this code only runs once per socket.
	s.used = true
	b1, b2 := splitHello(b)
	n1, err := conn.Write(b1)
	if err != nil {
		return n1, err
	}
	n2, err := conn.Write(b2)
	return n1 + n2, err
}

func (s *splitter) ReadFrom(reader io.Reader) (bytes int64, err error) {
	if !s.used {
		// This is the first write on this socket.
		// Use copyOnce(), which calls Write(), to get Write's splitting behavior for
		// the first segment.
		if bytes, err = copyOnce(s, reader); err != nil {
			return
		}
	}

	var b int64
	b, err = s.TCPConn.ReadFrom(reader)
	bytes += b
	return
}
