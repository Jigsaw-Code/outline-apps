// Copyright 2021 The Outline Authors
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

package https

import (
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io/ioutil"
	"net/http"
	"time"
)

// Request encapsulates an HTTPs request.
type Request struct {
	// URL is the HTTPs endpoint.
	URL string
	// Method is the HTTP method to use in the request.
	Method string
	// TrustedCertFingerprint is the sha256 hash of a server's trusted
	// (self-signed) TLS certificate.
	TrustedCertFingerprint []byte
}

// Response encapsulates an HTTPs response.
type Response struct {
	// Data is the received request payload.
	Data []byte
	// HTTPStatusCode is the HTTP status code of the response.
	HTTPStatusCode int
	// RedirectURL is the Location header of a HTTP redirect response.
	RedirectURL string
}

// Fetch retrieves data from an HTTPs server that may have a self-singed TLS
// certificate.
// Pins the trusted certificate when req.TrustedCertFingerprint is non-empty.
// Follows up to 10 HTTPs redirects and sets the response's RedirectURL to the
// last Location header URL when the status code is a permantent redirect.
// Returns an error if req.URL is a non-HTTPS URL, if there is a connection
// error to the server, or if reading the response fails.
func Fetch(req Request) (*Response, error) {
	httpreq, err := http.NewRequest(req.Method, req.URL, nil)
	if err != nil {
		return nil, err
	}
	if httpreq.URL.Scheme != "https" {
		return nil, errors.New("URL protocol must be HTTPs")
	}

	var redirectURL string
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Do not follow redirects automatically, save the Location header.
			redirectURL = req.Response.Header.Get("Location")
			return http.ErrUseLastResponse
		},
		Timeout: 30 * time.Second,
	}

	if req.TrustedCertFingerprint != nil && len(req.TrustedCertFingerprint) > 0 {
		client.Transport = &http.Transport{
			// Perform custom server certificate verification by pinning the
			// trusted certificate fingerprint.
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify:    true,
				VerifyPeerCertificate: makePinnedCertVerifier(req.TrustedCertFingerprint),
			},
		}
	}

	httpres, err := client.Do(httpreq)
	if err != nil {
		return nil, err
	}
	res := &Response{nil, httpres.StatusCode, redirectURL}
	res.Data, err = ioutil.ReadAll(httpres.Body)
	httpres.Body.Close()
	return res, err
}

type certVerifier func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error

// Verifies whether the pinned certificate SHA256 fingerprint,
// trustedCertFingerprint, matches the leaf certificate fingerprint, regardless
// of the system's TLS certificate validation errors.
func makePinnedCertVerifier(trustedCertFingerprint []byte) certVerifier {
	return func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
		if len(rawCerts) == 0 {
			return x509.CertificateInvalidError{
				Cert: nil, Reason: x509.NotAuthorizedToSign, Detail: "Did not receive TLS certificate"}
		}
		// Compute the sha256 digest of the whole DER-encoded certificate.
		fingerprint := sha256.Sum256(rawCerts[0])
		if bytes.Equal(fingerprint[:], trustedCertFingerprint) {
			return nil
		}
		return x509.CertificateInvalidError{
			Cert: nil, Reason: x509.NotAuthorizedToSign, Detail: "Failed to verify TLS certificate"}
	}
}
