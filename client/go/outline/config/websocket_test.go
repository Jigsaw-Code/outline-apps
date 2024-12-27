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

func Test_parseWebsocketStreamEndpoint(t *testing.T) {
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
