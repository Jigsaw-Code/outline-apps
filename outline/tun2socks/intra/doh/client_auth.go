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

package doh

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"

	"github.com/eycorsican/go-tun2socks/common/log"
)

// ClientAuth interface for providing TLS certificates and signatures.
type ClientAuth interface {
	// GetClientCertificate returns the client certificate (if any).
	// May block as the first call may cause certificates to load.
	// Returns a DER encoded X.509 client certificate.
	GetClientCertificate() []byte
	// GetIntermediateCertificate returns the chaining certificate (if any).
	// It does not block or cause certificates to load.
	// Returns a DER encoded X.509 certificate.
	GetIntermediateCertificate() []byte
	// Request a signature on a digest.
	Sign(digest []byte) []byte
}

// clientAuthWrapper manages certificate loading and usage during TLS handshakes.
// Implements crypto.Signer.
type clientAuthWrapper struct {
	signer              ClientAuth
}

// GetClientCertificate returns the client certificate chain as a tls.Certificate.
// Returns an empty Certificate on failure, permitting the handshake to
// continue without authentication.
// Implements tls.Config GetClientCertificate().
func (ca *clientAuthWrapper) GetClientCertificate(
	info *tls.CertificateRequestInfo) (*tls.Certificate, error) {
	if ca.signer == nil {
		log.Warnf("Client certificate requested but not supported")
		return &tls.Certificate{}, nil
	}
	cert := ca.signer.GetClientCertificate()
	if cert == nil {
		log.Warnf("Unable to fetch client certificate")
		return &tls.Certificate{}, nil
	}
	chain := [][]byte{cert}
	intermediate := ca.signer.GetIntermediateCertificate()
	if intermediate != nil {
		chain = append(chain, intermediate)
	}
	leaf, err := x509.ParseCertificate(cert)
	if err != nil {
		log.Warnf("Unable to parse client certificate: %v", err)
		return &tls.Certificate{}, nil
	}
	_, isECDSA := leaf.PublicKey.(*ecdsa.PublicKey)
	if !isECDSA {
		// RSA-PSS and RSA-SSA both need explicit signature generation support.
		log.Warnf("Only ECDSA client certificates are supported")
		return &tls.Certificate{}, nil
	}
	return &tls.Certificate{
		Certificate: chain,
		PrivateKey:  ca,
		Leaf:        leaf,
	}, nil
}

// Public returns the public key for the client certificate.
func (ca *clientAuthWrapper) Public() crypto.PublicKey {
	if ca.signer == nil {
		return nil
	}
	cert := ca.signer.GetClientCertificate()
	leaf, err := x509.ParseCertificate(cert)
	if err != nil {
		log.Warnf("Unable to parse client certificate: %v", err)
		return nil
	}
	return leaf.PublicKey
}

// Sign a digest.
func (ca *clientAuthWrapper) Sign(rand io.Reader, digest []byte, opts crypto.SignerOpts) ([]byte, error) {
	if ca.signer == nil {
		return nil, errors.New("no client certificate")
	}
	signature := ca.signer.Sign(digest)
	if signature == nil {
		return nil, errors.New("failed to create signature")
	}
	return signature, nil
}

func newClientAuthWrapper(signer ClientAuth) clientAuthWrapper {
	return clientAuthWrapper{
		signer: signer,
	}
}
