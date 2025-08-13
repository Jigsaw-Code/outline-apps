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
	"net/http"
	"net/url"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
)

// HTTPReporterConfig is the format for the HTTPReporter config.
type HTTPReporterConfig struct {
	URL      string
	Interval string
}

func NewHTTPReporterSubParser(httpClient *http.Client) func(ctx context.Context, input map[string]any) (Reporter, error) {
	return func(ctx context.Context, input map[string]any) (Reporter, error) {
		var config HTTPReporterConfig
		if err := configyaml.MapToAny(input, &config); err != nil {
			return nil, fmt.Errorf("invalid config format: %w", err)
		}

		collectorURL, err := url.Parse(config.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to report collector URL: %w", err)
		}
		reporter := &HTTPReporter{URL: *collectorURL, HttpClient: httpClient}

		if config.Interval != "" {
			interval, err := time.ParseDuration(config.Interval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse interval: %w", err)
			}
			if interval <= 0 {
				return nil, fmt.Errorf("tunnel usage interval must be greater than 0")
			}
			reporter.Interval = interval
		}

		return reporter, nil
	}
}
