// Copyright 2025 The Outline Authors
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

package outline

import (
	"context"
	"fmt"
	"net"
	"net/netip"

	"github.com/Jigsaw-Code/outline-sdk/transport"
)

// Code for demonstration purpose; don't use in production

type BasicAccessStreamDialer struct {
  direct, tlsFrag StreamDialer   // the default direct TCPDialer and TLSFragDialer
  raceDelay       time.Duration  // delay between two races
}

// DialStream probes whether the server is reachable, and returns an BasicAccessStreamConn.
func (d *BasicAccessStreamDialer) DialStream(ctx context.Context, addr string) (StreamConn, error) {
  directConn, err := d.direct.Dial(ctx, addr)
  if err != nil {
    return nil, errors.New("cannot reach target")
  }
  return &BasicAccessStreamConn{ directConn, d.tlsFrag, d.raceDelay /*, ... */ }, nil
}

type BasicAccessStreamConn struct {
  direct, frag, winner StreamConn     // the direct connection, the TLS frag connection, and their winner
  tlsFragDialer        StreamDialer
  raceDelay            time.Duration
  clientHello          bytes.Buffer   // the initial TLS client hello packet
  // ...
}

// Write writes data to both connections before the winner has been decided.
func (c *BasicAccessStreamConn) Write(d []byte) (int, error) {
  if c.winner != nil {
    return c.winner.Write(d)
  }
  n, err := c.direct.Write(d)
  if err != nil {
    d = d[:n]
  }
  if c.frag != nil {
    c.frag.Write(d)
  } else {
    c.clientHello.Write(d)
  }
  return n, err
}

// Read reads data from the winning connection.
// If the winner hasn't been decided yet, start the race
func (c *BasicAccessStreamConn) Read(d []byte) (int, error) {
  if c.winner != nil {
    return c.winner.Read(d)
  }
  c.once.Do(func() { c.raceReads(d) })
  return c.winner.Read(d)
}

// raceReads tries the direct connection, and then tries the frag connection later.
// This logic is over-simplified, there are many details to be done such as
// storing (n, err) and returning it to the caller of c.Read; as well as handling
// a lot of race conditions.
func (c *BasicAccessStreamConn) raceReads(rdbuf []byte) {
  succ := make(chan StreamConn, 1)
  fail := make(chan error, 1)

  go tryReadFromConn(c.direct, rdbuf, succ, fail)

  time.AfterFunc(c.raceDelay, func() {
    tmpBuf := make([]byte, len(rdBuf))
    c.tryFragConn(tmpBuf, succ, fail)
  })

  select {
  case conn := <-succ:
    c.winner = w
  case <-fail:
    c.winner = c.direct  // defaults to direct connection when failed
  }
}

// tryFragConn tries to connect using the TLS fragmentation strategy.
func (c *BasicAccessStreamConn) tryFragConn(rdbuf []byte, succ chan<- StreamConn, fail chan<- error) {
  if c.frag, err = c.tlsFragDialer.Dial(context.TODO(), c.addr); err != nil {
    fail <- err
    return
  }
  if _, err = c.clientHello.WriteTo(c.frag); err != nil {
    fail <- err
    return
  }
  tryReadFromConn(c.frag, rdbuf, succ, fail)
}

// tryReadFromConn tries to read one successful response from conn
func tryReadFromConn(conn StreamConn, rdbuf []byte, succ chan<- StreamConn, fail chan<- error) {
  for {
    if n, err := conn.Read(rdbuf); err != nil {
      fail <- err
      return
    } else if n > 0 {
      succ <- conn
      return
    }
  }
}
