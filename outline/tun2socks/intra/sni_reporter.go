// Copyright 2020 The Outline Authors
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

package intra

import (
	"io"
	"sync"
	"time"

	"github.com/Jigsaw-Code/choir"
	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/doh"
	"github.com/eycorsican/go-tun2socks/common/log"
)

// Number of bins to assign reports to.  Should be large enough for
// k-anonymity goals.  See the Choir documentation for more info.
const bins = 32

// Number of values in each report.  The two values are
// * success/failure
// * timeout/close
const values = 2

// Burst duration.  Only one report will be sent in each interval
// to avoid correlated reports.
const burst = 10 * time.Second

// tcpSNIReporter is a thread-safe wrapper around choir.Reporter
type tcpSNIReporter struct {
	mu     sync.RWMutex // Protects dns, suffix, and r.
	dns    doh.Transport
	suffix string
	r      choir.Reporter
}

// SetDNS changes the DNS transport used for uploading reports.
func (r *tcpSNIReporter) SetDNS(dns doh.Transport) {
	r.mu.Lock()
	r.dns = dns
	r.mu.Unlock()
}

// Send implements choir.ReportSender.
func (r *tcpSNIReporter) Send(report choir.Report) error {
	r.mu.RLock()
	suffix := r.suffix
	dns := r.dns
	r.mu.RUnlock()
	q, err := choir.FormatQuery(report, suffix)
	if err != nil {
		log.Warnf("Failed to construct query for Choir: %v", err)
		return nil
	}
	if _, err = dns.Query(q); err != nil {
		log.Infof("Failed to deliver query for Choir: %v", err)
	}
	return nil
}

// Configure initializes or reinitializes the reporter.
// `file` is the Choir salt file (persistent and initially empty).
// `suffix` is the domain to which reports will be sent.
// `country` is the two-letter ISO country code of the user's location.
func (r *tcpSNIReporter) Configure(file io.ReadWriter, suffix, country string) (err error) {
	r.mu.Lock()
	r.suffix = suffix
	r.r, err = choir.NewReporter(file, bins, values, country, burst, r)
	r.mu.Unlock()
	return
}

// Report converts `summary` into a Choir report and queues it for delivery.
func (r *tcpSNIReporter) Report(summary TCPSocketSummary) {
	if summary.Retry.Split == 0 {
		return // Nothing to report
	}

	r.mu.RLock()
	reporter := r.r
	r.mu.RUnlock()

	if reporter == nil {
		return // Reports are disabled
	}
	result := "failed"
	if summary.DownloadBytes > 0 {
		result = "success"
	}
	response := "closed"
	if summary.Retry.Timeout {
		response = "timeout"
	}
	resultValue, err := choir.NewValue(result)
	if err != nil {
		log.Fatalf("Bad result %s: %v", result, err)
	}
	responseValue, err := choir.NewValue(response)
	if err != nil {
		log.Fatalf("Bad response %s: %v", response, err)
	}
	if err := reporter.Report(summary.Retry.SNI, resultValue, responseValue); err != nil {
		log.Warnf("Choir report failed: %v", err)
	}
}
