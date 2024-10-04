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

package outline

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/platerrors"
	"github.com/stretchr/testify/require"
)

func TestFetchDynamicKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintln(w, `{"name": "my-test-key"}`)
	}))
	defer server.Close()

	result := FetchDynamicKey(server.URL)
	require.Nil(t, result.Error)
	require.Equal(t, "{\"name\": \"my-test-key\"}\n", result.Key)
}

func TestFetchDynamicKey_Redirection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintln(w, "ss://my-url-format-test-key")
	}))
	defer server.Close()

	redirStatuses := []int{
		http.StatusMovedPermanently,
		http.StatusFound,
		http.StatusSeeOther,
		http.StatusTemporaryRedirect,
		http.StatusPermanentRedirect,
	}

	for _, redirStatus := range redirStatuses {
		redirSvr := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, server.URL, redirStatus)
		}))
		defer redirSvr.Close()

		result := FetchDynamicKey(redirSvr.URL)
		require.Nil(t, result.Error)
		require.Equal(t, "ss://my-url-format-test-key\n", result.Key)
	}
}

func TestFetchDynamicKey_HTTPStatusError(t *testing.T) {
	errStatuses := []int{
		http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
	}

	for _, errStatus := range errStatuses {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(errStatus)
		}))
		defer server.Close()

		result := FetchDynamicKey(server.URL)
		require.Error(t, result.Error)
		require.Equal(t, platerrors.FetchConfigFailed, result.Error.Code)
		require.Error(t, result.Error.Cause)
	}
}

func TestFetchDynamicKey_BodyReadError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "1") // This will cause io.ReadAll to fail
	}))
	defer server.Close()

	result := FetchDynamicKey(server.URL)
	require.Error(t, result.Error)
	require.Equal(t, platerrors.FetchConfigFailed, result.Error.Code)
	require.Error(t, result.Error.Cause)
}
