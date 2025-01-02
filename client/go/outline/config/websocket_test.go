// Copyright 2024 The Outline Authors
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

package config

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/coder/websocket"
	"github.com/stretchr/testify/require"
)

func Test_parseWebsocketStreamEndpointSimple(t *testing.T) {
	mux := http.NewServeMux()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO(fortuna): support h2 and h3 on the server.
		require.Equal(t, "", r.TLS.NegotiatedProtocol)
		require.Equal(t, "HTTP/1.1", r.Proto)
		clientConn, err := websocket.Accept(w, r, nil)
		require.NoError(t, err)
		defer clientConn.CloseNow()

		resp := bytes.Buffer{}
		for {
			msgType, msg, err := clientConn.Read(r.Context())
			if errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)
			require.Equal(t, websocket.MessageBinary, msgType)
			_, err = resp.Write(msg)
			require.NoError(t, err)
		}
		require.Equal(t, []byte("Request"), resp.Bytes())

		err = clientConn.Write(r.Context(), websocket.MessageBinary, []byte("Resp"))
		require.NoError(t, err)
		err = clientConn.Write(r.Context(), websocket.MessageBinary, []byte("onse"))
		require.NoError(t, err)

		clientConn.Close(websocket.StatusNormalClosure, "")
	})
	mux.Handle("/tcp", http.StripPrefix("/tcp", handler))
	ts := httptest.NewUnstartedServer(mux)
	ts.EnableHTTP2 = true
	ts.StartTLS()
	defer ts.Close()

	config := map[string]any{
		"url": ts.URL + "/tcp",
	}
	client := ts.Client()
	// TODO(fortuna): Support h2. We can force h2 on the client with the code below.
	// client := &http.Client{
	// 	Transport: &http2.Transport{
	// 		TLSClientConfig: ts.Client().Transport.(*http.Transport).TLSClientConfig,
	// 	},
	// }
	ep, err := parseWebsocketStreamEndpoint(context.Background(), config, client)
	require.NoError(t, err)
	require.NotNil(t, ep)

	conn, err := ep.Connect(context.Background())
	require.NoError(t, err)
	require.NotNil(t, conn)

	n, err := conn.Write([]byte("Req"))
	require.NoError(t, err)
	require.Equal(t, 3, n)
	n, err = conn.Write([]byte("uest"))
	require.NoError(t, err)
	require.Equal(t, 4, n)

	conn.CloseWrite()

	resp, err := io.ReadAll(conn)
	require.NoError(t, err)
	require.Equal(t, []byte("Response"), resp)
}

func Test_parseWebsocketStreamEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	receivedByTarget := &bytes.Buffer{}
	sentByTarget := bytes.NewReader([]byte("Response"))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO(fortuna): support h2 and h3 on the server.
		require.Equal(t, "", r.TLS.NegotiatedProtocol)
		require.Equal(t, "HTTP/1.1", r.Proto)

		t.Log("Got stream request", "request", r)
		defer t.Log("Request done")
		clientConn, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Log("Failed to accept Websocket connection", "error", err)
			http.Error(w, "Failed to accept Websocket connection", http.StatusBadGateway)
			return
		}
		defer clientConn.CloseNow()

		// Handle client -> target.
		readClientDone := make(chan struct{})
		go func() {
			defer close(readClientDone)
			defer clientConn.CloseRead(r.Context())
			msgType, clientReader, err := clientConn.Reader(r.Context())
			if err != nil {
				clientConn.Close(websocket.StatusInternalError, "failed to get client reader")
				return
			}
			if msgType != websocket.MessageBinary {
				clientConn.Close(websocket.StatusInternalError, "client message is not binary")
				return
			}
			buf := make([]byte, 3000)
			for {
				n, err := clientReader.Read(buf)
				if err != nil {
					if !errors.Is(err, io.EOF) {
						t.Log("Failed to read from client", "error", err)
						clientConn.Close(websocket.StatusInternalError, "failed to read from client")
					}
					break
				}
				read := buf[:n]
				if _, err := receivedByTarget.Write(read); err != nil {
					t.Log("Failed to write to target", "error", err)
					clientConn.Close(websocket.StatusInternalError, "failed to write message to target")
					break
				}
				t.Log("receivedByTarget is", string(receivedByTarget.Bytes()))
			}
		}()
		// Handle target -> client
		func() {
			clientWriter, err := clientConn.Writer(r.Context(), websocket.MessageBinary)
			if err != nil {
				clientConn.Close(websocket.StatusInternalError, "failed to get client writer")
				return
			}
			defer clientWriter.Close()
			// About 2 MTUs
			buf := make([]byte, 300)
			for {
				n, err := sentByTarget.Read(buf)
				if err != nil {
					if !errors.Is(err, io.EOF) {
						t.Log("Failed to read from target", "error", err)
						clientConn.Close(websocket.StatusInternalError, "failed to read message from target")
					}
					break
				}
				read := buf[:n]
				if _, err := clientWriter.Write(read); err != nil {
					t.Log("Failed to write to client", "error", err)
					clientConn.Close(websocket.StatusInternalError, "failed to write message to client")
					break
				}
			}
			<-readClientDone
		}()
	})
	mux.Handle("/tcp", http.StripPrefix("/tcp", handler))
	ts := httptest.NewUnstartedServer(mux)
	ts.EnableHTTP2 = true
	ts.StartTLS()
	defer ts.Close()

	config := map[string]any{
		"url": ts.URL + "/tcp",
	}
	client := ts.Client()
	// TODO(fortuna): Support h2. We can force h2 on the client with the code below.
	// client := &http.Client{
	// 	Transport: &http2.Transport{
	// 		TLSClientConfig: ts.Client().Transport.(*http.Transport).TLSClientConfig,
	// 	},
	// }
	ep, err := parseWebsocketStreamEndpoint(context.Background(), config, client)
	require.NoError(t, err)
	require.NotNil(t, ep)

	conn, err := ep.Connect(context.Background())
	require.NoError(t, err)
	require.NotNil(t, conn)
	defer conn.Close()

	n, err := conn.Write([]byte("Req"))
	require.NoError(t, err)
	require.Equal(t, 3, n)
	n, err = conn.Write([]byte("uest"))
	require.NoError(t, err)
	require.Equal(t, 4, n)
	require.NoError(t, conn.CloseWrite())

	resp, err := io.ReadAll(conn)
	require.NoError(t, err)
	require.Equal(t, []byte("Response"), resp)
	require.Equal(t, []byte("Request"), receivedByTarget.Bytes())
}

func Test_parseWebsocketPacketEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO(fortuna): support h2 and h3 on the server.
		require.Equal(t, "", r.TLS.NegotiatedProtocol)
		require.Equal(t, "HTTP/1.1", r.Proto)
		clientConn, err := websocket.Accept(w, r, nil)
		require.NoError(t, err)
		defer clientConn.CloseNow()

		msgType, msg, err := clientConn.Read(r.Context())
		require.NoError(t, err)
		require.Equal(t, websocket.MessageBinary, msgType)
		require.Equal(t, []byte("Request"), msg)

		err = clientConn.Write(r.Context(), websocket.MessageBinary, []byte("Response"))
		require.NoError(t, err)

		clientConn.Close(websocket.StatusNormalClosure, "")
	})
	mux.Handle("/udp", http.StripPrefix("/udp", handler))
	ts := httptest.NewUnstartedServer(mux)
	ts.EnableHTTP2 = true
	ts.StartTLS()
	defer ts.Close()

	config := map[string]any{
		"url": ts.URL + "/udp",
	}
	client := ts.Client()
	ep, err := parseWebsocketPacketEndpoint(context.Background(), config, client)
	require.NoError(t, err)
	require.NotNil(t, ep)

	conn, err := ep.Connect(context.Background())
	require.NoError(t, err)
	require.NotNil(t, conn)

	n, err := conn.Write([]byte("Request"))
	require.NoError(t, err)
	require.Equal(t, 7, n)

	resp, err := io.ReadAll(conn)
	require.NoError(t, err)
	require.Equal(t, []byte("Response"), resp)
}
