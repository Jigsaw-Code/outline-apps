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
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/Jigsaw-Code/outline-apps/client/go/configyaml"
	"github.com/Jigsaw-Code/outline-sdk/transport"
	persistentcookiejar "go.nhat.io/cookiejar"
)

// HTTPReporterConfig is the format for the HTTPReporter config.
type HTTPReporterConfig struct {
	URL            string
	Interval       string
	Enable_Cookies bool
}

func NewHTTPReporterConfigParser(cookiesFilename string, streamDialer transport.StreamDialer) func(ctx context.Context, input map[string]any) (Reporter, error) {
	return func(ctx context.Context, input map[string]any) (Reporter, error) {
		var config HTTPReporterConfig
		if err := configyaml.MapToAny(input, &config); err != nil {
			return nil, fmt.Errorf("invalid config format: %w", err)
		}

		collectorURL, err := url.Parse(config.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse the report collector URL: %w", err)
		}

		httpClient := &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					if strings.HasPrefix(network, "tcp") {
						return streamDialer.DialStream(ctx, addr)
					} else {
						return nil, fmt.Errorf("protocol not supported: %v", network)
					}
				},
			},
		}

		if config.Enable_Cookies {
			if cookiesFilename == "" {
				return nil, errors.New("cookies filename is required for cookies")
			}
			// Make sure the  cookies directory exists.
			if err := os.MkdirAll(path.Dir(cookiesFilename), 0700); err != nil {
				return nil, fmt.Errorf("failed to create service data directory: %v", err)
			}
			cookieJar := persistentcookiejar.NewPersistentJar(persistentcookiejar.WithFilePath(cookiesFilename))
			httpClient.Jar = cookieJar
		}

		reporter := &HTTPReporter{URL: *collectorURL, HttpClient: httpClient}

		if config.Interval != "" {
			interval, err := time.ParseDuration(config.Interval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse interval: %w", err)
			}
			if interval < 1*time.Hour {
				return nil, fmt.Errorf("interval must be at least 1h")
			}
			reporter.Interval = interval
		}

		return reporter, nil
	}
}

