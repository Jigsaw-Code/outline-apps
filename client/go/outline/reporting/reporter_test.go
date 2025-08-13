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

package reporting

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestHTTPReporter_Report(t *testing.T) {
	var receivedRequest *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedRequest = r
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	serverURL, err := url.Parse(server.URL)
	require.NoError(t, err)

	reporter := &HTTPReporter{
		URL:        *serverURL,
		HttpClient: server.Client(),
	}

	require.NoError(t, reporter.Report())
	require.NotNil(t, receivedRequest, "Server did not receive the request")
	require.Equal(t, "POST", receivedRequest.Method)
}

func TestHTTPReporter_Report404(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/report" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	serverURL, err := url.Parse(server.URL)
	require.NoError(t, err)

	reporter := &HTTPReporter{
		URL:        *serverURL,
		HttpClient: server.Client(),
	}

	require.Error(t, reporter.Report())
}

func TestHTTPReporter_ReportInterval(t *testing.T) {
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	serverURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("Failed to parse server URL: %v", err)
	}

	reporter := &HTTPReporter{
		URL:        *serverURL,
		HttpClient: server.Client(),
		Interval:   100 * time.Millisecond,
	}

	sessionCtx, cancelSession := context.WithCancel(context.Background())

	go reporter.Run(sessionCtx)

	time.Sleep(450 * time.Millisecond)
	cancelSession()

	require.Equal(t, 5, requestCount)
}
