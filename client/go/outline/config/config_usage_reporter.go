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
	"strconv"
	"strings"
	"time"
)

// UsageReporterConfig is the format for the Usage Reporter config.
type UsageReporterConfig struct {
	Frequency string
	Url       string
}

func parseUsageReporterConfig(ctx context.Context, configMap map[string]any) (*UsageReporter, error) {
	var config UsageReporterConfig
	if err := mapToAny(configMap, &config); err != nil {
		return nil, fmt.Errorf("invalid config format: %w", err)
	}

	duration, err := ParseHumanDuration(config.Frequency)
	if err != nil {
		return nil, fmt.Errorf("failed to parse frequency: %w", err)
	}

	return &UsageReporter{
		frequency: duration,
		url:       config.Url,
	}, nil
}

func ParseHumanDuration(duration string) (time.Duration, error) {
	// Strip any whitespace
	duration = strings.TrimSpace(duration)
	if len(duration) < 2 {
		return 0, fmt.Errorf("invalid duration format: %s", duration)
	}

	// Extract the numeric value and unit
	numStr := duration[:len(duration)-1]
	unit := duration[len(duration)-1:]

	// Parse the numeric value
	num, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid number in duration: %s", numStr)
	}

	// Convert to time.Duration based on unit
	switch strings.ToLower(unit) {
	case "s":
		return time.Duration(num * float64(time.Second)), nil
	case "m":
		return time.Duration(num * float64(time.Minute)), nil
	case "h":
		return time.Duration(num * float64(time.Hour)), nil
	case "d":
		return time.Duration(num * 24 * float64(time.Hour)), nil
	case "w":
		return time.Duration(num * 7 * 24 * float64(time.Hour)), nil
	default:
		return 0, fmt.Errorf("unsupported duration unit: %s", unit)
	}
}
