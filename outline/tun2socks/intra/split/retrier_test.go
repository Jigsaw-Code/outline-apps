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
	"bytes"
	"io"
	"net"
	"testing"
	"time"
)

type setup struct {
	t              *testing.T
	server         *net.TCPListener
	clientSide     DuplexConn
	serverSide     *net.TCPConn
	serverReceived []byte
	stats          *RetryStats
}

func makeSetup(t *testing.T) *setup {
	addr, err := net.ResolveTCPAddr("tcp", ":0")
	if err != nil {
		t.Error(err)
	}
	server, err := net.ListenTCP("tcp", addr)
	if err != nil {
		t.Error(err)
	}

	serverAddr, ok := server.Addr().(*net.TCPAddr)
	if !ok {
		t.Error("Server isn't TCP?")
	}
	var stats RetryStats
	clientSide, err := DialWithSplitRetry(&net.Dialer{}, serverAddr, &stats)
	if err != nil {
		t.Error(err)
	}
	serverSide, err := server.AcceptTCP()
	if err != nil {
		t.Error(err)
	}
	return &setup{t, server, clientSide, serverSide, nil, &stats}
}

const BUFSIZE = 256

func makeBuffer() []byte {
	buffer := make([]byte, BUFSIZE)
	for i := 0; i < BUFSIZE; i++ {
		buffer[i] = byte(i)
	}
	return buffer
}

func send(src io.Writer, dest io.Reader, t *testing.T) []byte {
	buffer := makeBuffer()
	n, err := src.Write(buffer)
	if err != nil {
		t.Error(err)
	}
	if n != len(buffer) {
		t.Errorf("Failed to write whole buffer: %d", n)
	}

	buf := make([]byte, len(buffer))
	n, err = dest.Read(buf)
	if err != nil {
		t.Error(nil)
	}
	if n != len(buf) {
		t.Errorf("Not enough bytes: %d", n)
	}
	if !bytes.Equal(buf, buffer) {
		t.Errorf("Wrong contents")
	}
	return buf
}

func (s *setup) sendUp() {
	buf := send(s.clientSide, s.serverSide, s.t)
	s.serverReceived = append(s.serverReceived, buf...)
}

func (s *setup) sendDown() {
	send(s.serverSide, s.clientSide, s.t)
}

func closeRead(closed, blocked DuplexConn, t *testing.T) {
	closed.CloseRead()
	// TODO: Figure out if this is detectable on the opposite side.
}

func closeWrite(closed, blocked DuplexConn, t *testing.T) {
	closed.CloseWrite()
	n, err := blocked.Read(make([]byte, 1))
	if err != io.EOF || n > 0 {
		t.Errorf("Read should have failed with EOF")
	}
}

func (s *setup) closeReadUp() {
	closeRead(s.clientSide, s.serverSide, s.t)
}

func (s *setup) closeWriteUp() {
	closeWrite(s.clientSide, s.serverSide, s.t)
}

func (s *setup) closeReadDown() {
	closeRead(s.serverSide, s.clientSide, s.t)
}

func (s *setup) closeWriteDown() {
	closeWrite(s.serverSide, s.clientSide, s.t)
}

func (s *setup) close() {
	s.server.Close()
}

func (s *setup) confirmRetry() {
	done := make(chan struct{})
	go func() {
		buf := make([]byte, len(s.serverReceived))
		n, err := s.clientSide.Read(buf)
		if err != nil {
			s.t.Error(err)
		}
		if n != len(buf) {
			s.t.Error("Unexpected echo length")
		}
		close(done)
	}()

	var err error
	s.serverSide, err = s.server.AcceptTCP()
	if err != nil {
		s.t.Errorf("Second socket failed")
	}
	buf := make([]byte, len(s.serverReceived))
	var n int
	for n < len(buf) {
		var m int
		m, err = s.serverSide.Read(buf[n:])
		n += m
		if err != nil {
			s.t.Error(err)
		}
	}
	if !bytes.Equal(buf, s.serverReceived) {
		s.t.Errorf("Replay was corrupted")
	}

	n, err = s.serverSide.Write(buf)
	if err != nil {
		s.t.Error(err)
	}
	if n != len(buf) {
		s.t.Errorf("Couldn't echo all bytes: %d", n)
	}
	<-done
}

func (s *setup) checkNoSplit() {
	if s.stats.Split > 0 {
		s.t.Error("Retry should not have occurred")
	}
}

func (s *setup) checkStats(bytes int32, chunks int16, timeout bool) {
	r := s.stats
	if r.Bytes != bytes {
		s.t.Errorf("Expected %d bytes, got %d", bytes, r.Bytes)
	}
	if r.Chunks != chunks {
		s.t.Errorf("Expected %d chunks, got %d", chunks, r.Chunks)
	}
	if r.Timeout != timeout {
		s.t.Errorf("Expected timeout to be %t", timeout)
	}
	if r.Split < 32 || r.Split > 64 {
		s.t.Errorf("Unexpected split: %d", r.Split)
	}
}

func TestNormalConnection(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.sendDown()
	s.closeReadUp()
	s.closeWriteUp()
	s.close()
	s.checkNoSplit()
}

func TestFinRetry(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.serverSide.Close()
	s.confirmRetry()
	s.sendDown()
	s.closeReadUp()
	s.closeWriteUp()
	s.close()
	s.checkStats(BUFSIZE, 1, false)
}

func TestTimeoutRetry(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	// Client should time out and retry after about 1.2 seconds
	time.Sleep(2 * time.Second)
	s.confirmRetry()
	s.sendDown()
	s.closeReadUp()
	s.closeWriteUp()
	s.close()
	s.checkStats(BUFSIZE, 1, true)
}

func TestTwoWriteRetry(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.sendUp()
	s.serverSide.Close()
	s.confirmRetry()
	s.sendDown()
	s.closeReadUp()
	s.closeWriteUp()
	s.close()
	s.checkStats(2*BUFSIZE, 2, false)
}

func TestFailedRetry(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.serverSide.Close()
	s.confirmRetry()
	s.closeReadDown()
	s.closeWriteDown()
	s.close()
	s.checkStats(BUFSIZE, 1, false)
}

func TestDisappearingServer(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.close()
	s.serverSide.Close()
	// Try to read 1 byte to trigger the retry.
	n, err := s.clientSide.Read(make([]byte, 1))
	if n > 0 || err == nil {
		t.Error("Expected read to fail")
	}
	s.clientSide.CloseRead()
	s.clientSide.CloseWrite()
	s.checkNoSplit()
}

func TestSequentialClose(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.closeWriteUp()
	s.sendDown()
	s.closeWriteDown()
	s.close()
	s.checkNoSplit()
}

func TestBackwardsUse(t *testing.T) {
	s := makeSetup(t)
	s.sendDown()
	s.closeWriteDown()
	s.sendUp()
	s.closeWriteUp()
	s.close()
	s.checkNoSplit()
}

// Regression test for an issue in which the initial handshake timeout
// continued to apply after the handshake completed.
func TestIdle(t *testing.T) {
	s := makeSetup(t)
	s.sendUp()
	s.sendDown()
	// Wait for longer than the 1.2-second response timeout
	time.Sleep(2 * time.Second)
	// Try to send down some more data.
	s.sendDown()
	s.close()
	s.checkNoSplit()
}
