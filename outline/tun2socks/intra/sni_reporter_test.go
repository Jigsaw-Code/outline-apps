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
	"bytes"
	"errors"
	"strings"
	"testing"

	"golang.org/x/net/dns/dnsmessage"

	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/doh"
	"github.com/Jigsaw-Code/outline-apps/outline/tun2socks/intra/split"
)

type qfunc func(q []byte) ([]byte, error)

type fakeTransport struct {
	doh.Transport
	query qfunc
}

func (t *fakeTransport) Query(q []byte) ([]byte, error) {
	return t.query(q)
}

func newFakeTransport(query qfunc) *fakeTransport {
	return &fakeTransport{query: query}
}

func sendReport(t *testing.T, r *tcpSNIReporter, summary TCPSocketSummary, response []byte, responseErr error) string {
	// This function blocks for the burst duration (10 seconds), so it's important that
	// all tests that use it run in parallel to avoid extreme test delays.
	t.Parallel()

	c := make(chan string)
	dns := newFakeTransport(func(q []byte) ([]byte, error) {
		var msg dnsmessage.Message
		err := msg.Unpack(q)
		if err != nil {
			t.Fatal(err)
		}
		name := msg.Questions[0].Name.String()
		c <- name
		return response, responseErr
	})
	r.SetDNS(dns)
	r.Report(summary)
	return <-c
}

const suffix = "mydomain.example"
const country = "zz"

func runSuccessTest(t *testing.T, summary TCPSocketSummary) string {
	r := tcpSNIReporter{}
	var stubFile bytes.Buffer
	r.Configure(&stubFile, suffix, country)
	return sendReport(t, &r, summary, make([]byte, 100), nil)
}

func TestSuccessClosed(t *testing.T) {
	summary := TCPSocketSummary{
		DownloadBytes: 10000, // >0 indicates success
		UploadBytes:   5000,
		Retry: &split.RetryStats{
			Timeout: false,              // Socket was explicitly closed
			Split:   48,                 // >0 indicates a split was attempted
			SNI:     "user.domain.test", // SNI of the socket
		},
	}
	name := runSuccessTest(t, summary)
	labels := strings.Split(name, ".")
	if labels[0] != "success" {
		t.Errorf("Bad name %s, %s != success", name, labels[0])
	}
	if labels[1] != "closed" {
		t.Errorf("Bad name %s, %s != closed", name, labels[1])
	}
	// labels[2] is the bin, which is random.
	if labels[3] != "zz" {
		t.Errorf("Bad name %s, %s != zz", name, labels[1])
	}
	// labels[4] is the date, which is not controlled by the code under test.
	remainder := strings.Join(labels[5:], ".")
	expected := summary.Retry.SNI + "." + suffix + "."
	if remainder != expected {
		t.Errorf("Bad name %s, %s != %s", name, remainder, expected)
	}
}

func TestTimeout(t *testing.T) {
	summary := TCPSocketSummary{
		DownloadBytes: 10000, // >0 indicates success
		UploadBytes:   5000,
		Retry: &split.RetryStats{
			Timeout: true,               // Socket timed out
			Split:   54,                 // >0 indicates a split was attempted
			SNI:     "user.domain.test", // SNI of the socket
		},
	}
	name := runSuccessTest(t, summary)
	labels := strings.Split(name, ".")
	if labels[1] != "timeout" {
		t.Errorf("Bad name %s, %s != timeout", name, labels[1])
	}
}

func TestFail(t *testing.T) {
	summary := TCPSocketSummary{
		DownloadBytes: 0, // 0 indicates failure
		UploadBytes:   500,
		Retry: &split.RetryStats{
			Timeout: true,               // Socket timed out
			Split:   36,                 // >0 indicates a split was attempted
			SNI:     "user.domain.test", // SNI of the socket
		},
	}
	name := runSuccessTest(t, summary)
	labels := strings.Split(name, ".")
	if labels[0] != "failed" {
		t.Errorf("Bad name %s, %s != failed", name, labels[0])
	}
}

func TestError(t *testing.T) {
	r := tcpSNIReporter{}
	var stubFile bytes.Buffer
	r.Configure(&stubFile, suffix, country)
	summary := TCPSocketSummary{
		DownloadBytes: 5000,
		UploadBytes:   500,
		Retry: &split.RetryStats{
			Timeout: true,
			Split:   36,
			SNI:     "user.domain.test",
		},
	}
	// Verify that I/O errors don't cause a panic.
	sendReport(t, &r, summary, nil, errors.New("DNS send failed"))
}

func TestNoSplit(t *testing.T) {
	r := tcpSNIReporter{}
	var stubFile bytes.Buffer
	r.Configure(&stubFile, suffix, country)
	summary := TCPSocketSummary{
		DownloadBytes: 5000,
		UploadBytes:   500,
		Retry: &split.RetryStats{
			Timeout: true,
			Split:   0,
			SNI:     "user.domain.test",
		},
	}
	dns := newFakeTransport(func(q []byte) ([]byte, error) {
		t.Error("DNS query function should not be called because no split was performed")
		return nil, errors.New("Unreachable")
	})
	r.SetDNS(dns)
	r.Report(summary)
}

func TestUnconfigured(t *testing.T) {
	r := tcpSNIReporter{}
	summary := TCPSocketSummary{
		DownloadBytes: 5000,
		UploadBytes:   500,
		Retry: &split.RetryStats{
			Timeout: true,
			Split:   45,
			SNI:     "user.domain.test",
		},
	}
	dns := newFakeTransport(func(q []byte) ([]byte, error) {
		t.Error("DNS query function should not be called because the reporter is not configured")
		return nil, errors.New("Unreachable")
	})
	r.SetDNS(dns)
	r.Report(summary)
}

func TestNoDNS(t *testing.T) {
	r := tcpSNIReporter{}
	summary := TCPSocketSummary{
		DownloadBytes: 5000,
		UploadBytes:   500,
		Retry: &split.RetryStats{
			Timeout: true,
			Split:   45,
			SNI:     "user.domain.test",
		},
	}
	// Verify that this doesn't panic.
	r.Report(summary)
}
