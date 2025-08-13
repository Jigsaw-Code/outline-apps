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
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

// Reporter is used to register reports.
type Reporter interface {
	// Run blocks until the session context is done.
	Run(sessionCtx context.Context)
}

type HTTPReporter struct {
	URL        url.URL
	Interval   time.Duration
	HttpClient *http.Client
}

func (r *HTTPReporter) Run(sessionCtx context.Context) {
	r.Report()
	ticker := time.NewTicker(r.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-sessionCtx.Done():
			return
		case _, ok := <-ticker.C:
			if !ok {
				return
			}
			r.Report()
		}
	}
}

func (r *HTTPReporter) Report() {
	slog.Debug("Sending report", "url", r.URL.String())

	req, err := http.NewRequest("POST", r.URL.String(), nil)
	if err != nil {
		slog.Warn("Failed to create report HTTP request", "err", err)
		return
	}
	req.Close = true

	resp, err := r.HttpClient.Do(req)
	if err != nil {
		slog.Warn("Failed to send report", "err", err)
		return
	}
	resp.Body.Close()
}
