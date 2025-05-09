/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package reporting

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/Jigsaw-Code/outline-sdk/transport/shadowsocks"
)

const uniqueClientID = "random_client_id"

var server *http.Server
var clientCookie string

func TestReport(t *testing.T) {
	err := Report(&fakeSSClient{}, "https://example.com")
	if err != nil {
		t.Fatalf("Report failed: %v", err)
	}
	// Report again to get the original cookie.
	err = Report(&fakeSSClient{}, "https://example.com")
	if err != nil {
		t.Fatalf("Report failed: %v", err)
	}
	time.Sleep(1 * time.Second) // Give the server a moment to process the request
	if clientCookie != uniqueClientID {
		t.Fatalf("Expected client cookie %s, got %s", uniqueClientID, clientCookie)
	}
}

func setup() {
	server = &http.Server{Addr: ":8080", Handler: http.HandlerFunc(echoHandler)}
	go func() {
		fmt.Println("Starting server on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Failed to start server: %v\n", err)
		}
	}()
	time.Sleep(1 * time.Second) // Give the server a moment to start
}

func teardown() {
	if err := server.Shutdown(context.Background()); err != nil {
		fmt.Printf("Failed to shutdown server: %v\n", err)
	}
}

func TestMain(m *testing.M) {
	setup()
	code := m.Run()
	teardown()
	os.Exit(code)
}

// Fake shadowsocks.Client that can be configured to return failing UDP and TCP connections.
type fakeSSClient struct {
	failReachability   bool
	failAuthentication bool
	failUDP            bool
}

func (c *fakeSSClient) DialStream(_ context.Context, raddr string) (transport.StreamConn, error) {
	conn, err := net.Dial("tcp", "localhost:8080")
	if err != nil {
		return nil, err
	}
	if c.failReachability {
		// OpError.Error() panics if Err is nil.
		return nil, &net.OpError{Err: errors.New("unreachable fakeSSClient")}
	}
	return &fakeDuplexConn{conn: conn, failRead: c.failAuthentication}, nil
}
func (c *fakeSSClient) ListenPacket(_ context.Context) (net.PacketConn, error) {
	conn, err := net.ListenPacket("udp", "")
	if err != nil {
		return nil, err
	}
	// The UDP check should fail if any of the failure conditions are true since it is a superset of the others.
	failRead := c.failAuthentication || c.failUDP || c.failReachability
	return &fakePacketConn{PacketConn: conn, failRead: failRead}, nil
}
func (c *fakeSSClient) SetTCPSaltGenerator(salter shadowsocks.SaltGenerator) {
}

// Fake PacketConn that fails `ReadFrom` calls when `failRead` is true.
type fakePacketConn struct {
	net.PacketConn
	addr     net.Addr
	failRead bool
}

func (c *fakePacketConn) WriteTo(b []byte, addr net.Addr) (int, error) {
	c.addr = addr
	return len(b), nil // Write always succeeds
}

func (c *fakePacketConn) ReadFrom(b []byte) (int, net.Addr, error) {
	if c.failRead {
		return 0, c.addr, errors.New("Fake read error")
	}
	return len(b), c.addr, nil
}

// Fake DuplexConn that fails `Read` calls when `failRead` is true.
type fakeDuplexConn struct {
	transport.StreamConn
	conn     net.Conn
	failRead bool
}

func (c *fakeDuplexConn) Read(b []byte) (int, error) {
	if c.failRead {
		return 0, errors.New("Fake read error")
	}
	return c.conn.Read(b)
}

func (c *fakeDuplexConn) Write(b []byte) (int, error) {
	return c.conn.Write(b)
}

func (c *fakeDuplexConn) Close() error { return nil }

func (c *fakeDuplexConn) LocalAddr() net.Addr { return nil }

func (c *fakeDuplexConn) RemoteAddr() net.Addr { return nil }

func (c *fakeDuplexConn) SetDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) SetReadDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) SetWriteDeadline(t time.Time) error { return nil }

func (c *fakeDuplexConn) CloseRead() error { return nil }

func (c *fakeDuplexConn) CloseWrite() error { return nil }

// Ensure fakeHTTPConn implements transport.StreamConn
var _ transport.StreamConn = (*fakeDuplexConn)(nil)

func echoHandler(w http.ResponseWriter, r *http.Request) {
	// Check if the cookie is already set
	cookie, err := r.Cookie("client-id")
	if err != nil {
		// If the cookie is not set, generate a unique ID and set the cookie
		if err == http.ErrNoCookie {
			http.SetCookie(w, &http.Cookie{
				Name:   "client-id",
				Domain: "example.com",
				Value:  uniqueClientID,
				Path:   "/",
			})
			fmt.Printf("Set new client-id cookie: %s\n", uniqueClientID)
		} else {
			http.Error(w, "Failed to read cookie", http.StatusInternalServerError)
			return
		}
	} else {
		fmt.Printf("Existing client-id cookie: %s\n", cookie.Value)
		clientCookie = cookie.Value
		http.SetCookie(w, cookie)
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	fmt.Fprintf(w, "Echo: %s", body)
}
