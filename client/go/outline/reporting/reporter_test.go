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
	"testing"
	"testing/synctest"
	"time"

	"os"
	"path"

	persistentcookiejar "go.nhat.io/cookiejar"

	"github.com/stretchr/testify/require"
)

func TestHTTPReporter_CookiePersistence(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "reporting_test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	cookieJarFile := path.Join(tempDir, "cookies")
	var receivedCookies []*http.Cookie
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.Cookies()) > 0 {
			receivedCookies = r.Cookies()
		} else {
			http.SetCookie(w, &http.Cookie{Name: "test_cookie", Value: "test_value"})
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	newRequest := func() (*http.Request, error) {
		return http.NewRequest("POST", server.URL, nil)
	}

	jar1 := persistentcookiejar.NewPersistentJar(persistentcookiejar.WithFilePath(cookieJarFile), persistentcookiejar.WithAutoSync(true))
	client1 := &http.Client{Jar: jar1}
	reporter1 := &HTTPReporter{
		NewRequest: newRequest,
		HttpClient: client1,
	}
	require.NoError(t, reporter1.Report())
	require.Empty(t, receivedCookies)

	jar2 := persistentcookiejar.NewPersistentJar(persistentcookiejar.WithFilePath(cookieJarFile), persistentcookiejar.WithAutoSync(true))
	client2 := &http.Client{Jar: jar2}
	reporter2 := &HTTPReporter{
		NewRequest: newRequest,
		HttpClient: client2,
	}
	require.NoError(t, reporter2.Report())
	require.NotEmpty(t, receivedCookies)
	require.Equal(t, "test_cookie", receivedCookies[0].Name)
	require.Equal(t, "test_value", receivedCookies[0].Value)
}

func TestHTTPReporter_Report(t *testing.T) {
	var receivedRequest *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedRequest = r
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	newRequest := func() (*http.Request, error) {
		req, err := http.NewRequest("POST", server.URL, nil)
		require.NoError(t, err)
		return req, nil
	}

	reporter := &HTTPReporter{
		NewRequest: newRequest,
		HttpClient: server.Client(),
	}

	require.NoError(t, reporter.Report())
	require.NotNil(t, receivedRequest, "Server did not receive the request")
	require.Equal(t, "POST", receivedRequest.Method)
}

func TestHTTPReporter_Report404(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	newRequest := func() (*http.Request, error) {
		return http.NewRequest("POST", server.URL, nil)
	}

	reporter := &HTTPReporter{
		NewRequest: newRequest,
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

	newRequest := func() (*http.Request, error) {
		return http.NewRequest("POST", server.URL, nil)
	}

	reporter := &HTTPReporter{
		NewRequest: newRequest,
		HttpClient: server.Client(),
		Interval:   100 * time.Millisecond,
	}

	sessionCtx, cancelSession := context.WithCancel(context.Background())

	synctest.Test(t, func(t *testing.T) {
		go reporter.Run(sessionCtx)
		time.Sleep(450 * time.Millisecond)
		cancelSession()
	})

	require.Equal(t, 5, requestCount)
}
