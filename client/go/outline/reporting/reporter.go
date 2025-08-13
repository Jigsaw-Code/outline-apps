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
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/useragent"
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
	r.reportAndLogError()
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
			r.reportAndLogError()
		}
	}
}

func (r *HTTPReporter) reportAndLogError() {
	slog.Debug("Sending report", "url", r.URL.String())
	err := r.Report()
	if err != nil {
		slog.Warn("Failed to report", "err", err)
	}
}

func (r *HTTPReporter) Report() error {
	req, err := http.NewRequest("POST", r.URL.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to create report HTTP request: %w", err)
	}
	req.Close = true
	// TODO: Add Outline Client version.
	req.Header.Add("User-Agent", useragent.GetOutlineUserAgent())

	resp, err := r.HttpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send report: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("report failed with status code %d", resp.StatusCode)
	}
	return nil
}
