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

package config

import (
	"context"
	"fmt"
	"time"
)

// UsageReporterConfig is the format for the Usage Reporter config.
type UsageReporterConfig struct {
	Interval      string
	Url           string
	EnableCookies bool `json:"enable_cookies"`
}

func parseUsageReporterConfig(ctx context.Context, configMap map[string]any) (*UsageReporter, error) {
	var config UsageReporterConfig
	if err := mapToAny(configMap, &config); err != nil {
		return nil, fmt.Errorf("invalid config format: %w", err)
	}

	duration, err := time.ParseDuration(config.Interval)
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}

	return &UsageReporter{
		Interval:      duration,
		Url:           config.Url,
		EnableCookies: config.EnableCookies,
	}, nil
}
