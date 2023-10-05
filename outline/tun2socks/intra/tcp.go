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

// Derived from go-tun2socks's "direct" handler under the Apache 2.0 license.

package intra

import (
	"io"
	"net/netip"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/split"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// TCPSocketSummary provides information about each TCP socket, reported when it is closed.
type TCPSocketSummary struct {
	DownloadBytes int64 // Total bytes downloaded.
	UploadBytes   int64 // Total bytes uploaded.
	Duration      int32 // Duration in seconds.
	ServerPort    int16 // The server port.  All values except 80, 443, and 0 are set to -1.
	Synack        int32 // TCP handshake latency (ms)
	// Retry is non-nil if retry was possible.  Retry.Split is non-zero if a retry occurred.
	Retry *split.RetryStats
}

func makeTCPSocketSummary(dest netip.AddrPort) *TCPSocketSummary {
	stats := &TCPSocketSummary{
		ServerPort: int16(dest.Port()),
	}
	if stats.ServerPort != 0 && stats.ServerPort != 80 && stats.ServerPort != 443 {
		stats.ServerPort = -1
	}
	return stats
}

// TCPListener is notified when a socket closes.
type TCPListener interface {
	OnTCPSocketClosed(*TCPSocketSummary)
}

type tcpWrapConn struct {
	transport.StreamConn

	wg           *sync.WaitGroup
	rDone, wDone atomic.Bool

	beginTime time.Time
	stats     *TCPSocketSummary

	listener    TCPListener
	sniReporter *tcpSNIReporter
}

func makeTCPWrapConn(c transport.StreamConn, stats *TCPSocketSummary, listener TCPListener, sniReporter *tcpSNIReporter) (conn *tcpWrapConn) {
	conn = &tcpWrapConn{
		StreamConn:  c,
		wg:          &sync.WaitGroup{},
		beginTime:   time.Now(),
		stats:       stats,
		listener:    listener,
		sniReporter: sniReporter,
	}

	// Wait until both read and write are done
	conn.wg.Add(2)
	go func() {
		conn.wg.Wait()
		conn.stats.Duration = int32(time.Since(conn.beginTime))
		if conn.listener != nil {
			conn.listener.OnTCPSocketClosed(conn.stats)
		}
		if conn.stats.Retry != nil && conn.sniReporter != nil {
			conn.sniReporter.Report(*conn.stats)
		}
	}()

	return
}

func (conn *tcpWrapConn) Close() error {
	defer conn.close(&conn.wDone)
	defer conn.close(&conn.rDone)
	return conn.StreamConn.Close()
}

func (conn *tcpWrapConn) CloseRead() error {
	defer conn.close(&conn.rDone)
	return conn.StreamConn.CloseRead()
}

func (conn *tcpWrapConn) CloseWrite() error {
	defer conn.close(&conn.wDone)
	return conn.StreamConn.CloseWrite()
}

func (conn *tcpWrapConn) Read(b []byte) (n int, err error) {
	defer func() {
		conn.stats.DownloadBytes += int64(n)
	}()
	return conn.StreamConn.Read(b)
}

func (conn *tcpWrapConn) WriteTo(w io.Writer) (n int64, err error) {
	defer func() {
		conn.stats.DownloadBytes += n
	}()
	return io.Copy(w, conn.StreamConn)
}

func (conn *tcpWrapConn) Write(b []byte) (n int, err error) {
	defer func() {
		conn.stats.UploadBytes += int64(n)
	}()
	return conn.StreamConn.Write(b)
}

func (conn *tcpWrapConn) ReadFrom(r io.Reader) (n int64, err error) {
	defer func() {
		conn.stats.UploadBytes += n
	}()
	return io.Copy(conn.StreamConn, r)
}

func (conn *tcpWrapConn) close(done *atomic.Bool) {
	// make sure conn.wg is being called at most once for a specific `done` flag
	if done.CompareAndSwap(false, true) {
		conn.wg.Done()
	}
}
