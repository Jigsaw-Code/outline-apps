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
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"testing"
)

// PEM encoded test leaf certificate with ECDSA public key.
var ecCertificate string = `-----BEGIN CERTIFICATE-----
MIIBpTCCAQ4CAiAAMA0GCSqGSIb3DQEBCwUAMD4xCzAJBgNVBAYTAlVTMQswCQYD
VQQIDAJDQTEWMBQGA1UEBwwNTW91bnRhaW4gVmlldzEKMAgGA1UECgwBWDAeFw0y
MDExMDQwNTU2MTZaFw0zMDExMDIwNTU2MTZaMD4xCzAJBgNVBAYTAlVTMQswCQYD
VQQIDAJDQTEWMBQGA1UEBwwNTW91bnRhaW4gVmlldzEKMAgGA1UECgwBWDBZMBMG
ByqGSM49AgEGCCqGSM49AwEHA0IABNFVWlOs0tnaLgiutLbPISCd5Fn9UJz6oDen
prTOrHz11PiO/XiqwpJY8yO72QappL/7RYV+uw9hJfU+YOE3tZQwDQYJKoZIhvcN
AQELBQADgYEAdy6CNPvIA7DrS6WrN7N4ZjHjeUtjj2w8n5abTHhvANEvIHI0DARI
AoJJWp4Pe41mzFhROzo+U/ofC2b+ukA8sYqoio4QUxlSW3HkzUAR4HZMi8Risvo3
OxSR9Lw/mGvZrJ8xr070EwnsD+cCZLfYQ0mSKDM9uPfI3YrgCVKyUwE=
-----END CERTIFICATE-----`

// PKCS8 encoded test ECDSA private key.
var ecKey string = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgIlI6NB+skAYL36XP
JvE+x5Nlbn0wvw2hlSqIqADiZhShRANCAATRVVpTrNLZ2i4IrrS2zyEgneRZ/VCc
+qA3p6a0zqx89dT4jv14qsKSWPMju9kGqaS/+0WFfrsPYSX1PmDhN7WU
-----END PRIVATE KEY-----`

// PEM encoded test leaf certificate with RSA public key.
// Doubles as an intermediate depending on the test.
var rsaCertificate string = `-----BEGIN CERTIFICATE-----
MIICWDCCAcGgAwIBAgIUS36guwZMKNO0ADReGLi0cZq8fOowDQYJKoZIhvcNAQEL
BQAwPjELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRYwFAYDVQQHDA1Nb3VudGFp
biBWaWV3MQowCAYDVQQKDAFYMB4XDTIwMTEwNDA1NDgyNVoXDTMwMTEwMjA1NDgy
NVowPjELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRYwFAYDVQQHDA1Nb3VudGFp
biBWaWV3MQowCAYDVQQKDAFYMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDd
eznqVu1Rn0m8KR4mX/qVv6uytzZ+juqW5VD55D+w9N6JryPpFHPi4VIm8PKLXp3X
GvY9mc8r+0Ow1qJZYoc/X0Na1c79bv9xwbD3aK28FlAs1+cmyesaFhCWa0bYAvcy
mqQGYhObEWb46E5AANV82CitDE9C1aXRT4SvkLnc6wIDAQABo1MwUTAdBgNVHQ4E
FgQUnUib8BhOHqjq9+gqPQ+ePyEW9zwwHwYDVR0jBBgwFoAUnUib8BhOHqjq9+gq
PQ+ePyEW9zwwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOBgQAx/uZG
Gmb5w/u4UkdH7wnoOUNx6GwdraqtQWnFaXb87PmuVAjBwSAnzes2mlp/Vbcd6tYs
pPuHrxOcWgw/aRV6rK3vJZIH3DGvy1pNphGgegEcG88nrUCDcQqPLxvPJ8bmbaee
Tf+l5U2OHC3Yifb4FDOv47kGmq5VeWiYdp60/A==
-----END CERTIFICATE-----`

// PKCS8 encoded test RSA private key.
var rsaKey string = `-----BEGIN PRIVATE KEY-----
MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAN17OepW7VGfSbwp
HiZf+pW/q7K3Nn6O6pblUPnkP7D03omvI+kUc+LhUibw8otendca9j2Zzyv7Q7DW
ollihz9fQ1rVzv1u/3HBsPdorbwWUCzX5ybJ6xoWEJZrRtgC9zKapAZiE5sRZvjo
TkAA1XzYKK0MT0LVpdFPhK+QudzrAgMBAAECgYEAoCdhI8Ej7qe+S993u8wfiXWG
FL9DGpUBsYe03F5eZ/lJikopL3voqKDCJQKKgJk0jb0jXjwAgQ86TX+G+hezL5jp
xOOfMmTYgMwnUuFYN1gHAd+TnYB9G1qSQr9TOw3K9Rf4q2x09GhLP75qdr+qzmIR
YGle5ZSP0LqKNkpGNUECQQD+6CxOO8+knnzIFvqkUyNDVFR5ALRNpb53TGVITNf3
ysT32oJ75ButA0l4q/jsL+MeLLvrHkJOHN+ydLaZOUkbAkEA3m5cICisW9lsT+Rj
glXykkbj3Ougldy7rhPivAaS7clk8cl8cDcIvHna1mDlhSanUu/s4TFEXBLnSzee
XLNIcQJBAJ0n3TD6lSEkCUB/UlX/X81B77aOZZs9pXj9o6/4mGoQHHHGyQ3C7AE1
9pUsSZKsT3UqFU124WAxUwU+CdnbxKMCQB/QrUC0UKL6oHF0+37DCGU/2ovY8Ck/
X2Dw2zeFwTJd4iBrb28lkAxVaaXMSkgXVUuZoco8H8kDsy2hEPe1dSECQQCPw5Yg
2gdmdpUk+QetqqhSuuIDwILHU9m3CoX3rY+njaR5LOWDz3utC9Ogo+4wdIMamP/o
2SAWPAZPqDUbtqGH
-----END PRIVATE KEY-----`

// fakeClientAuth implements the ClientAuth interface for testing.
type fakeClientAuth struct {
	certificate  *x509.Certificate
	intermediate *x509.Certificate
	key          crypto.PrivateKey
}

func (ca *fakeClientAuth) GetClientCertificate() []byte {
	if ca.certificate == nil {
		// Interface uses nil for errors to support binding.
		return nil
	}
	return ca.certificate.Raw
}

func (ca *fakeClientAuth) GetIntermediateCertificate() []byte {
	if ca.intermediate == nil {
		return nil
	}
	return ca.intermediate.Raw
}

func (ca *fakeClientAuth) Sign(digest []byte) []byte {
	if ca.key == nil {
		return nil
	}
	if k, isECDSA := ca.key.(*ecdsa.PrivateKey); isECDSA {
		signature, err := ecdsa.SignASN1(rand.Reader, k, digest)
		if err != nil {
			return nil
		}
		return signature
	}
	// Unsupported key type
	return nil
}

func newFakeClientAuth(certificate, intermediate, key []byte) (*fakeClientAuth, error) {
	ca := &fakeClientAuth{}
	if certificate != nil {
		certX509, err := x509.ParseCertificate(certificate)
		if err != nil {
			return nil, fmt.Errorf("certificate: %v", err)
		}
		ca.certificate = certX509
	}
	if intermediate != nil {
		intX509, err := x509.ParseCertificate(intermediate)
		if err != nil {
			return nil, fmt.Errorf("intermediate: %v", err)
		}
		ca.intermediate = intX509
	}
	if key != nil {
		key, err := x509.ParsePKCS8PrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("private key: %v", err)
		}
		ca.key = key
	}
	return ca, nil
}

func newCertificateRequestInfo() *tls.CertificateRequestInfo {
	return &tls.CertificateRequestInfo{
		Version: tls.VersionTLS13,
	}
}

func newToBeSigned(message []byte) ([]byte, crypto.SignerOpts) {
	digest := sha256.Sum256(message)
	opts := crypto.SignerOpts(crypto.SHA256)
	return digest[:], opts
}

// Simulate a TLS handshake that requires a client cert and signature.
func TestSign(t *testing.T) {
	certDer, _ := pem.Decode([]byte(ecCertificate))
	keyDer, _ := pem.Decode([]byte(ecKey))
	intDer, _ := pem.Decode([]byte(rsaCertificate))
	ca, err := newFakeClientAuth(certDer.Bytes, intDer.Bytes, keyDer.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	wrapper := newClientAuthWrapper(ca)
	// TLS stack requests the client cert.
	req := newCertificateRequestInfo()
	cert, err := wrapper.GetClientCertificate(req)
	if err != nil {
		t.Fatal("Expected to get a client certificate")
	}
	if cert == nil {
		// From the crypto.tls docs:
		// If GetClientCertificate returns an error, the handshake will
		// be aborted and that error will be returned. Otherwise
		// GetClientCertificate must return a non-nil Certificate.
		t.Error("GetClientCertificate must return a non-nil certificate")
	}
	if len(cert.Certificate) != 2 {
		t.Fatal("Certificate chain is the wrong length")
	}
	if !bytes.Equal(cert.Certificate[0], certDer.Bytes) {
		t.Error("Problem with certificate chain[0]")
	}
	if !bytes.Equal(cert.Certificate[1], intDer.Bytes) {
		t.Error("Problem with certificate chain[1]")
	}
	// TLS stack requests a signature.
	digest, opts := newToBeSigned([]byte("hello world"))
	signature, err := wrapper.Sign(rand.Reader, digest, opts)
	if err != nil {
		t.Fatal(err)
	}
	// Verify the signature.
	pub, ok := wrapper.Public().(*ecdsa.PublicKey)
	if !ok {
		t.Fatal("Expected public key to be ECDSA")
	}
	if !ecdsa.VerifyASN1(pub, digest, signature) {
		t.Fatal("Problem verifying signature")
	}
}

// Simulate a client that does not use an intermediate certificate.
func TestSignNoIntermediate(t *testing.T) {
	certDer, _ := pem.Decode([]byte(ecCertificate))
	keyDer, _ := pem.Decode([]byte(ecKey))
	ca, err := newFakeClientAuth(certDer.Bytes, nil, keyDer.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	wrapper := newClientAuthWrapper(ca)
	// TLS stack requests a client cert.
	req := newCertificateRequestInfo()
	cert, err := wrapper.GetClientCertificate(req)
	if err != nil {
		t.Error("Expected to get a client certificate")
	}
	if cert == nil {
		t.Error("GetClientCertificate must return a non-nil certificate")
	}
	if len(cert.Certificate) != 1 {
		t.Error("Certificate chain is the wrong length")
	}
	if !bytes.Equal(cert.Certificate[0], certDer.Bytes) {
		t.Error("Problem with certificate chain[0]")
	}
	// TLS stack requests a signature
	digest, opts := newToBeSigned([]byte("hello world"))
	signature, err := wrapper.Sign(rand.Reader, digest, opts)
	if err != nil {
		t.Error(err)
	}
	// Verify the signature.
	pub, ok := wrapper.Public().(*ecdsa.PublicKey)
	if !ok {
		t.Error("Expected public key to be ECDSA")
	}
	if !ecdsa.VerifyASN1(pub, digest, signature) {
		t.Error("Problem verifying signature")
	}
}

// Simulate a client that does not have a certificate.
func TestNoAuth(t *testing.T) {
	ca, err := newFakeClientAuth(nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	wrapper := newClientAuthWrapper(ca)
	// TLS stack requests a client cert.
	req := newCertificateRequestInfo()
	cert, err := wrapper.GetClientCertificate(req)
	if err != nil {
		t.Error("Expected to get a client certificate")
	}
	if cert == nil {
		t.Error("GetClientCertificate must return a non-nil certificate")
	}
	if len(cert.Certificate) != 0 {
		t.Error("Certificate chain is the wrong length")
	}
	// TLS stack requests a signature. This should not happen in real life
	// because cert.Certificate is empty.
	public := wrapper.Public()
	if public != nil {
		t.Error("Expected public to be nil")
	}
	digest, opts := newToBeSigned([]byte("hello world"))
	_, err = wrapper.Sign(rand.Reader, digest, opts)
	if err == nil {
		t.Error("Expected Sign() to fail")
	}
}

// Simulate a client that has an RSA certificate.
func TestRSACertificate(t *testing.T) {
	certDer, _ := pem.Decode([]byte(rsaCertificate))
	keyDer, _ := pem.Decode([]byte(rsaKey))
	ca, err := newFakeClientAuth(certDer.Bytes, nil, keyDer.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	wrapper := newClientAuthWrapper(ca)
	// TLS stack requests a client cert.  We should not return one because
	// we don't support RSA.
	req := newCertificateRequestInfo()
	cert, err := wrapper.GetClientCertificate(req)
	if err != nil {
		t.Error("Expected to get a client certificate")
	}
	if cert == nil {
		t.Error("GetClientCertificate must return a non-nil certificate")
	}
	if len(cert.Certificate) != 0 {
		t.Error("Unexpectedly loaded an RSA certificate")
	}
	// TLS stack requests a signature. This should not happen in real life
	// because cert.Certificate is empty.
	digest, opts := newToBeSigned([]byte("hello world"))
	_, err = wrapper.Sign(rand.Reader, digest, opts)
	if err == nil {
		t.Error("Expected Sign() to fail")
	}
}

// Simulate a nil loader.
func TestNilLoader(t *testing.T) {
	wrapper := newClientAuthWrapper(nil)
	// TLS stack requests the client cert.
	req := newCertificateRequestInfo()
	cert, err := wrapper.GetClientCertificate(req)
	if err != nil {
		t.Fatal(err)
	}
	if cert == nil {
		// From the crypto.tls docs:
		// If GetClientCertificate returns an error, the handshake will
		// be aborted and that error will be returned. Otherwise
		// GetClientCertificate must return a non-nil Certificate.
		t.Error("GetClientCertificate must return a non-nil certificate")
	}
	if len(cert.Certificate) != 0 {
		t.Fatal("Expected an empty certificate chain")
	}
	// TLS stack requests a signature. This should not happen in real life
	// because cert.Certificate is empty.
	digest, opts := newToBeSigned([]byte("hello world"))
	_, err = wrapper.Sign(rand.Reader, digest, opts)
	if err == nil {
		t.Error("Expected Sign() to fail")
	}
}
