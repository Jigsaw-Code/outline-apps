// Copyright 2019 The Outline Authors
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
	"encoding/binary"
	"errors"
	"golang.org/x/net/dns/dnsmessage"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"reflect"
	"testing"
)

var testURL = "https://dns.google/dns-query"
var ips = []string{
	"8.8.8.8",
	"8.8.4.4",
	"2001:4860:4860::8888",
	"2001:4860:4860::8844",
}
var parsedURL *url.URL

var simpleQuery dnsmessage.Message = dnsmessage.Message{
	Header: dnsmessage.Header{
		ID:                 0xbeef,
		Response:           false,
		OpCode:             0,
		Authoritative:      false,
		Truncated:          false,
		RecursionDesired:   true,
		RecursionAvailable: false,
		RCode:              0,
	},
	Questions: []dnsmessage.Question{
		{
			Name:  dnsmessage.MustNewName("www.example.com."),
			Type:  dnsmessage.TypeA,
			Class: dnsmessage.ClassINET,
		}},
	Answers:     []dnsmessage.Resource{},
	Authorities: []dnsmessage.Resource{},
	Additionals: []dnsmessage.Resource{},
}

func mustPack(m *dnsmessage.Message) []byte {
	packed, err := m.Pack()
	if err != nil {
		panic(err)
	}
	return packed
}

func mustUnpack(q []byte) *dnsmessage.Message {
	var m dnsmessage.Message
	err := m.Unpack(q)
	if err != nil {
		panic(err)
	}
	return &m
}

var simpleQueryBytes []byte = mustPack(&simpleQuery)

var compressedQueryBytes []byte = []byte{
	0xbe, 0xef, // ID
	0x01,       // QR, OPCODE, AA, TC, RD
	0x00,       // RA, Z, RCODE
	0x00, 0x02, // QDCOUNT = 2
	0x00, 0x00, // ANCOUNT = 0
	0x00, 0x00, // NSCOUNT = 0
	0x00, 0x00, // ARCOUNT = 0
	// Question 1
	0x03, 'f', 'o', 'o',
	0x03, 'b', 'a', 'r',
	0x00,
	0x00, 0x01, // QTYPE: A query
	0x00, 0x01, // QCLASS: IN
	// Question 2
	0xc0, 12, // Pointer to beginning of "foo.bar."
	0x00, 0x01, // QTYPE: A query
	0x00, 0x01, // QCLASS: IN
}

var uncompressedQueryBytes []byte = []byte{
	0xbe, 0xef, // ID
	0x01,       // QR, OPCODE, AA, TC, RD
	0x00,       // RA, Z, RCODE
	0x00, 0x02, // QDCOUNT = 2
	0x00, 0x00, // ANCOUNT = 0
	0x00, 0x00, // NSCOUNT = 0
	0x00, 0x00, // ARCOUNT = 0
	// Question 1
	0x03, 'f', 'o', 'o',
	0x03, 'b', 'a', 'r',
	0x00,
	0x00, 0x01, // QTYPE: A query
	0x00, 0x01, // QCLASS: IN
	// Question 2
	0x03, 'f', 'o', 'o',
	0x03, 'b', 'a', 'r',
	0x00,
	0x00, 0x01, // QTYPE: A query
	0x00, 0x01, // QCLASS: IN
}

func init() {
	parsedURL, _ = url.Parse(testURL)
}

// Check that the constructor works.
func TestNewTransport(t *testing.T) {
	_, err := NewTransport(testURL, ips, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
}

// Check that the constructor rejects unsupported URLs.
func TestBadUrl(t *testing.T) {
	_, err := NewTransport("ftp://www.example.com", nil, nil, nil, nil)
	if err == nil {
		t.Error("Expected error")
	}
	_, err = NewTransport("https://www.example", nil, nil, nil, nil)
	if err == nil {
		t.Error("Expected error")
	}
}

// Check for failure when the query is too short to be valid.
func TestShortQuery(t *testing.T) {
	var qerr *queryError
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	_, err := doh.Query([]byte{})
	if err == nil {
		t.Error("Empty query should fail")
	} else if !errors.As(err, &qerr) {
		t.Errorf("Wrong error type: %v", err)
	} else if qerr.status != BadQuery {
		t.Errorf("Wrong error status: %d", qerr.status)
	}

	_, err = doh.Query([]byte{1})
	if err == nil {
		t.Error("One byte query should fail")
	} else if !errors.As(err, &qerr) {
		t.Errorf("Wrong error type: %v", err)
	} else if qerr.status != BadQuery {
		t.Errorf("Wrong error status: %d", qerr.status)
	}
}

// Send a DoH query to an actual DoH server
func TestQueryIntegration(t *testing.T) {
	queryData := []byte{
		111, 222, // [0-1]   query ID
		1, 0, // [2-3]   flags, RD=1
		0, 1, // [4-5]   QDCOUNT (number of queries) = 1
		0, 0, // [6-7]   ANCOUNT (number of answers) = 0
		0, 0, // [8-9]   NSCOUNT (number of authoritative answers) = 0
		0, 0, // [10-11] ARCOUNT (number of additional records) = 0
		// Start of first query
		7, 'y', 'o', 'u', 't', 'u', 'b', 'e',
		3, 'c', 'o', 'm',
		0,    // null terminator of FQDN (DNS root)
		0, 1, // QTYPE = A
		0, 1, // QCLASS = IN (Internet)
	}

	testQuery := func(queryData []byte) {

		doh, err := NewTransport(testURL, ips, nil, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		resp, err2 := doh.Query(queryData)
		if err2 != nil {
			t.Fatal(err2)
		}
		if resp[0] != queryData[0] || resp[1] != queryData[1] {
			t.Error("Query ID mismatch")
		}
		if len(resp) <= len(queryData) {
			t.Error("Response is short")
		}
	}

	testQuery(queryData)

	paddedQueryBytes, err := AddEdnsPadding(simpleQueryBytes)
	if err != nil {
		t.Fatal(err)
	}

	testQuery(paddedQueryBytes)
}

type testRoundTripper struct {
	http.RoundTripper
	req  chan *http.Request
	resp chan *http.Response
	err  error
}

func makeTestRoundTripper() *testRoundTripper {
	return &testRoundTripper{
		req:  make(chan *http.Request),
		resp: make(chan *http.Response),
	}
}

func (r *testRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if r.err != nil {
		return nil, r.err
	}
	r.req <- req
	return <-r.resp, nil
}

// Check that a DNS query is converted correctly into an HTTP query.
func TestRequest(t *testing.T) {
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt
	go doh.Query(simpleQueryBytes)
	req := <-rt.req
	if req.URL.String() != testURL {
		t.Errorf("URL mismatch: %s != %s", req.URL.String(), testURL)
	}
	reqBody, err := ioutil.ReadAll(req.Body)
	if err != nil {
		t.Error(err)
	}
	if len(reqBody)%PaddingBlockSize != 0 {
		t.Errorf("reqBody has unexpected length: %d", len(reqBody))
	}
	// Parse reqBody into a Message.
	newQuery := mustUnpack(reqBody)
	// Ensure the converted request has an ID of zero.
	if newQuery.Header.ID != 0 {
		t.Errorf("Unexpected request header id: %v", newQuery.Header.ID)
	}
	// Check that all fields except for Header.ID and Additionals
	// are the same as the original.  Additionals may differ if
	// padding was added.
	if !queriesMostlyEqual(simpleQuery, *newQuery) {
		t.Errorf("Unexpected query body:\n\t%v\nExpected:\n\t%v", newQuery, simpleQuery)
	}
	contentType := req.Header.Get("Content-Type")
	if contentType != "application/dns-message" {
		t.Errorf("Wrong content type: %s", contentType)
	}
	accept := req.Header.Get("Accept")
	if accept != "application/dns-message" {
		t.Errorf("Wrong Accept header: %s", accept)
	}
}

// Check that all fields of m1 match those of m2, except for Header.ID
// and Additionals.
func queriesMostlyEqual(m1 dnsmessage.Message, m2 dnsmessage.Message) bool {
	// Make fields we don't care about match, so that equality check is easy.
	m1.Header.ID = m2.Header.ID
	m1.Additionals = m2.Additionals
	return reflect.DeepEqual(m1, m2)
}

// Check that a DOH response is returned correctly.
func TestResponse(t *testing.T) {
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt

	// Fake server.
	go func() {
		<-rt.req
		r, w := io.Pipe()
		rt.resp <- &http.Response{
			StatusCode: 200,
			Body:       r,
			Request:    &http.Request{URL: parsedURL},
		}
		// The DOH response should have a zero query ID.
		var modifiedQuery dnsmessage.Message = simpleQuery
		modifiedQuery.Header.ID = 0
		w.Write(mustPack(&modifiedQuery))
		w.Close()
	}()

	resp, err := doh.Query(simpleQueryBytes)
	if err != nil {
		t.Error(err)
	}

	// Parse the response as a DNS message.
	respParsed := mustUnpack(resp)

	// Query() should reconstitute the query ID in the response.
	if respParsed.Header.ID != simpleQuery.Header.ID ||
		!queriesMostlyEqual(*respParsed, simpleQuery) {
		t.Errorf("Unexpected response %v", resp)
	}
}

// Simulate an empty response.  (This is not a compliant server
// behavior.)
func TestEmptyResponse(t *testing.T) {
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt

	// Fake server.
	go func() {
		<-rt.req
		// Make an empty body.
		r, w := io.Pipe()
		w.Close()
		rt.resp <- &http.Response{
			StatusCode: 200,
			Body:       r,
			Request:    &http.Request{URL: parsedURL},
		}
	}()

	_, err := doh.Query(simpleQueryBytes)
	var qerr *queryError
	if err == nil {
		t.Error("Empty body should cause an error")
	} else if !errors.As(err, &qerr) {
		t.Errorf("Wrong error type: %v", err)
	} else if qerr.status != BadResponse {
		t.Errorf("Wrong error status: %d", qerr.status)
	}
}

// Simulate a non-200 HTTP response code.
func TestHTTPError(t *testing.T) {
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt

	go func() {
		<-rt.req
		r, w := io.Pipe()
		rt.resp <- &http.Response{
			StatusCode: 500,
			Body:       r,
			Request:    &http.Request{URL: parsedURL},
		}
		w.Write([]byte{0, 0, 8, 9, 10})
		w.Close()
	}()

	_, err := doh.Query(simpleQueryBytes)
	var qerr *queryError
	if err == nil {
		t.Error("Empty body should cause an error")
	} else if !errors.As(err, &qerr) {
		t.Errorf("Wrong error type: %v", err)
	} else if qerr.status != HTTPError {
		t.Errorf("Wrong error status: %d", qerr.status)
	}
}

// Simulate an HTTP query error.
func TestSendFailed(t *testing.T) {
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt

	rt.err = errors.New("test")
	_, err := doh.Query(simpleQueryBytes)
	var qerr *queryError
	if err == nil {
		t.Error("Send failure should be reported")
	} else if !errors.As(err, &qerr) {
		t.Errorf("Wrong error type: %v", err)
	} else if qerr.status != SendFailed {
		t.Errorf("Wrong error status: %d", qerr.status)
	} else if !errors.Is(qerr, rt.err) {
		t.Errorf("Underlying error is not retained")
	}
}

// Test if DoH resolver IPs are confirmed and disconfirmed
// when queries suceeded and fail, respectively.
func TestDohIPConfirmDisconfirm(t *testing.T) {
	u, _ := url.Parse(testURL)
	doh, _ := NewTransport(testURL, ips, nil, nil, nil)
	transport := doh.(*transport)
	hostname := u.Hostname()
	ipmap := transport.ips.Get(hostname)

	// send a valid request to first have confirmed-ip set
	res, _ := doh.Query(simpleQueryBytes)
	mustUnpack(res)
	ip1 := ipmap.Confirmed()

	if ip1 == nil {
		t.Errorf("IP not confirmed despite valid query to %s", u)
	}

	// simulate http-fail with doh server-ip set to previously confirmed-ip
	rt := makeTestRoundTripper()
	transport.client.Transport = rt
	go func() {
		req := <-rt.req
		trace := httptrace.ContextClientTrace(req.Context())
		trace.GotConn(httptrace.GotConnInfo{
			Conn: &fakeConn{
				remoteAddr: &net.TCPAddr{
					IP:   ip1, // confirmed-ip from before
					Port: 443,
				}}})
		rt.resp <- &http.Response{
			StatusCode: 509, // some non-2xx status
			Body:       nil,
			Request:    &http.Request{URL: u},
		}
	}()
	doh.Query(simpleQueryBytes)
	ip2 := ipmap.Confirmed()

	if ip2 != nil {
		t.Errorf("IP confirmed (%s) despite err", ip2)
	}
}

type fakeListener struct {
	Listener
	summary *Summary
}

func (l *fakeListener) OnQuery(url string) Token {
	return nil
}

func (l *fakeListener) OnResponse(tok Token, summ *Summary) {
	l.summary = summ
}

type fakeConn struct {
	net.TCPConn
	remoteAddr *net.TCPAddr
}

func (c *fakeConn) RemoteAddr() net.Addr {
	return c.remoteAddr
}

// Check that the DNSListener is called with a correct summary.
func TestListener(t *testing.T) {
	listener := &fakeListener{}
	doh, _ := NewTransport(testURL, ips, nil, nil, listener)
	transport := doh.(*transport)
	rt := makeTestRoundTripper()
	transport.client.Transport = rt

	go func() {
		req := <-rt.req
		trace := httptrace.ContextClientTrace(req.Context())
		trace.GotConn(httptrace.GotConnInfo{
			Conn: &fakeConn{
				remoteAddr: &net.TCPAddr{
					IP:   net.ParseIP("192.0.2.2"),
					Port: 443,
				}}})

		r, w := io.Pipe()
		rt.resp <- &http.Response{
			StatusCode: 200,
			Body:       r,
			Request:    &http.Request{URL: parsedURL},
		}
		w.Write([]byte{0, 0, 8, 9, 10})
		w.Close()
	}()

	doh.Query(simpleQueryBytes)
	s := listener.summary
	if s.Latency < 0 {
		t.Errorf("Negative latency: %f", s.Latency)
	}
	if !bytes.Equal(s.Query, simpleQueryBytes) {
		t.Errorf("Wrong query: %v", s.Query)
	}
	if !bytes.Equal(s.Response, []byte{0xbe, 0xef, 8, 9, 10}) {
		t.Errorf("Wrong response: %v", s.Response)
	}
	if s.Server != "192.0.2.2" {
		t.Errorf("Wrong server IP string: %s", s.Server)
	}
	if s.Status != Complete {
		t.Errorf("Wrong status: %d", s.Status)
	}
}

type socket struct {
	r io.ReadCloser
	w io.WriteCloser
}

func (c *socket) Read(b []byte) (int, error) {
	return c.r.Read(b)
}

func (c *socket) Write(b []byte) (int, error) {
	return c.w.Write(b)
}

func (c *socket) Close() error {
	e1 := c.r.Close()
	e2 := c.w.Close()
	if e1 != nil {
		return e1
	}
	return e2
}

func makePair() (io.ReadWriteCloser, io.ReadWriteCloser) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()
	return &socket{r1, w2}, &socket{r2, w1}
}

type fakeTransport struct {
	Transport
	query    chan []byte
	response chan []byte
	err      error
}

func (t *fakeTransport) Query(q []byte) ([]byte, error) {
	t.query <- q
	if t.err != nil {
		return nil, t.err
	}
	return <-t.response, nil
}

func (t *fakeTransport) GetURL() string {
	return "fake"
}

func (t *fakeTransport) Close() {
	t.err = errors.New("closed")
	close(t.query)
	close(t.response)
}

func newFakeTransport() *fakeTransport {
	return &fakeTransport{
		query:    make(chan []byte),
		response: make(chan []byte),
	}
}

// Test a successful query over TCP
func TestAccept(t *testing.T) {
	doh := newFakeTransport()
	client, server := makePair()

	// Start the forwarder running.
	go Accept(doh, server)

	lbuf := make([]byte, 2)
	// Send Query
	queryData := simpleQueryBytes
	binary.BigEndian.PutUint16(lbuf, uint16(len(queryData)))
	n, err := client.Write(lbuf)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Error("Length write problem")
	}
	n, err = client.Write(queryData)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(queryData) {
		t.Error("Query write problem")
	}

	// Read query
	queryRead := <-doh.query
	if !bytes.Equal(queryRead, queryData) {
		t.Error("Query mismatch")
	}

	// Send fake response
	responseData := []byte{1, 2, 8, 9, 10}
	doh.response <- responseData

	// Get Response
	n, err = client.Read(lbuf)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Error("Length read problem")
	}
	rlen := binary.BigEndian.Uint16(lbuf)
	resp := make([]byte, int(rlen))
	n, err = client.Read(resp)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(responseData, resp) {
		t.Error("Response mismatch")
	}

	client.Close()
}

// Sends a TCP query that results in failure.  When a query fails,
// Accept should close the TCP socket.
func TestAcceptFail(t *testing.T) {
	doh := newFakeTransport()
	client, server := makePair()

	// Start the forwarder running.
	go Accept(doh, server)

	lbuf := make([]byte, 2)
	// Send Query
	queryData := simpleQueryBytes
	binary.BigEndian.PutUint16(lbuf, uint16(len(queryData)))
	client.Write(lbuf)
	client.Write(queryData)

	// Indicate that the query failed
	doh.err = errors.New("fake error")

	// Read query
	queryRead := <-doh.query
	if !bytes.Equal(queryRead, queryData) {
		t.Error("Query mismatch")
	}

	// Accept should have closed the socket.
	n, _ := client.Read(lbuf)
	if n != 0 {
		t.Error("Expected to read 0 bytes")
	}
}

// Sends a TCP query, and closes the socket before the response is sent.
// This tests for crashes when a response cannot be delivered.
func TestAcceptClose(t *testing.T) {
	doh := newFakeTransport()
	client, server := makePair()

	// Start the forwarder running.
	go Accept(doh, server)

	lbuf := make([]byte, 2)
	// Send Query
	queryData := simpleQueryBytes
	binary.BigEndian.PutUint16(lbuf, uint16(len(queryData)))
	client.Write(lbuf)
	client.Write(queryData)

	// Read query
	queryRead := <-doh.query
	if !bytes.Equal(queryRead, queryData) {
		t.Error("Query mismatch")
	}

	// Close the TCP connection
	client.Close()

	// Send fake response too late.
	responseData := []byte{1, 2, 8, 9, 10}
	doh.response <- responseData
}

// Test failure due to a response that is larger than the
// maximum message size for DNS over TCP (65535).
func TestAcceptOversize(t *testing.T) {
	doh := newFakeTransport()
	client, server := makePair()

	// Start the forwarder running.
	go Accept(doh, server)

	lbuf := make([]byte, 2)
	// Send Query
	queryData := simpleQueryBytes
	binary.BigEndian.PutUint16(lbuf, uint16(len(queryData)))
	client.Write(lbuf)
	client.Write(queryData)

	// Read query
	<-doh.query

	// Send oversize response
	doh.response <- make([]byte, 65536)

	// Accept should have closed the socket because the response
	// cannot be written.
	n, _ := client.Read(lbuf)
	if n != 0 {
		t.Error("Expected to read 0 bytes")
	}
}

func TestComputePaddingSize(t *testing.T) {
	if computePaddingSize(100-kOptPaddingHeaderLen, 100) != 0 {
		t.Errorf("Expected no padding")
	}
	if computePaddingSize(200-kOptPaddingHeaderLen, 100) != 0 {
		t.Errorf("Expected no padding")
	}
	if computePaddingSize(190-kOptPaddingHeaderLen, 100) != 10 {
		t.Errorf("Expected to pad up to next block")
	}
}

func TestAddEdnsPaddingIdempotent(t *testing.T) {
	padded, err := AddEdnsPadding(simpleQueryBytes)
	if err != nil {
		t.Fatal(err)
	}
	paddedAgain, err := AddEdnsPadding(padded)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(padded, paddedAgain) {
		t.Errorf("Padding should be idempotent\n%v\n%v", padded, paddedAgain)
	}
}

// Check that packing |compressedQueryBytes| constructs the same query
// byte-for-byte.
func TestDnsMessageCompressedQueryConfidenceCheck(t *testing.T) {
	m := mustUnpack(compressedQueryBytes)
	packedBytes := mustPack(m)
	if len(packedBytes) != len(compressedQueryBytes) {
		t.Errorf("Packed query has different size than original:\n  %v\n  %v", packedBytes, compressedQueryBytes)
	}
}

// Check that packing |uncompressedQueryBytes| constructs a smaller
// query byte-for-byte, since label compression is enabled by default.
func TestDnsMessageUncompressedQueryConfidenceCheck(t *testing.T) {
	m := mustUnpack(uncompressedQueryBytes)
	packedBytes := mustPack(m)
	if len(packedBytes) >= len(uncompressedQueryBytes) {
		t.Errorf("Compressed query is not smaller than uncompressed query")
	}
}

// Check that we correctly pad an uncompressed query to the nearest block.
func TestAddEdnsPaddingUncompressedQuery(t *testing.T) {
	if len(uncompressedQueryBytes)%PaddingBlockSize == 0 {
		t.Errorf("uncompressedQueryBytes does not require padding, so this test is invalid")
	}
	padded, err := AddEdnsPadding(uncompressedQueryBytes)
	if err != nil {
		panic(err)
	}
	if len(padded)%PaddingBlockSize != 0 {
		t.Errorf("AddEdnsPadding failed to correctly pad uncompressed query")
	}
}

// Check that we correctly pad a compressed query to the nearest block.
func TestAddEdnsPaddingCompressedQuery(t *testing.T) {
	if len(compressedQueryBytes)%PaddingBlockSize == 0 {
		t.Errorf("compressedQueryBytes does not require padding, so this test is invalid")
	}
	padded, err := AddEdnsPadding(compressedQueryBytes)
	if err != nil {
		panic(err)
	}
	if len(padded)%PaddingBlockSize != 0 {
		t.Errorf("AddEdnsPadding failed to correctly pad compressed query")
	}
}

// Try to pad a query that already contains an OPT record, but no padding option.
func TestAddEdnsPaddingCompressedOptQuery(t *testing.T) {
	optQuery := simpleQuery
	optQuery.Additionals = make([]dnsmessage.Resource, len(simpleQuery.Additionals))
	copy(optQuery.Additionals, simpleQuery.Additionals)

	optQuery.Additionals = append(optQuery.Additionals,
		dnsmessage.Resource{
			Header: dnsmessage.ResourceHeader{
				Name:  dnsmessage.MustNewName("."),
				Class: dnsmessage.ClassINET,
				TTL:   0,
			},
			Body: &dnsmessage.OPTResource{
				Options: []dnsmessage.Option{},
			},
		},
	)
	paddedOnWire, err := AddEdnsPadding(mustPack(&optQuery))
	if err != nil {
		t.Errorf("Failed to pad query with OPT but no padding: %v", err)
	}
	if len(paddedOnWire)%PaddingBlockSize != 0 {
		t.Errorf("AddEdnsPadding failed to correctly pad query with OPT but no padding")
	}
}

// Try to pad a query that already contains an OPT record with padding. The
// query should be unmodified by AddEdnsPadding.
func TestAddEdnsPaddingCompressedPaddedQuery(t *testing.T) {
	paddedQuery := simpleQuery
	paddedQuery.Additionals = make([]dnsmessage.Resource, len(simpleQuery.Additionals))
	copy(paddedQuery.Additionals, simpleQuery.Additionals)

	paddedQuery.Additionals = append(paddedQuery.Additionals,
		dnsmessage.Resource{
			Header: dnsmessage.ResourceHeader{
				Name:  dnsmessage.MustNewName("."),
				Class: dnsmessage.ClassINET,
				TTL:   0,
			},
			Body: &dnsmessage.OPTResource{
				Options: []dnsmessage.Option{
					{
						Code: OptResourcePaddingCode,
						Data: make([]byte, 5),
					},
				},
			},
		},
	)
	originalOnWire := mustPack(&paddedQuery)

	paddedOnWire, err := AddEdnsPadding(mustPack(&paddedQuery))
	if err != nil {
		t.Errorf("Failed to pad padded query: %v", err)
	}

	if !bytes.Equal(originalOnWire, paddedOnWire) {
		t.Errorf("AddEdnsPadding tampered with a query that was already padded")
	}
}

func TestServfail(t *testing.T) {
	sf, err := Servfail(simpleQueryBytes)
	if err != nil {
		t.Fatal(err)
	}
	servfail := mustUnpack(sf)
	expectedHeader := dnsmessage.Header{
		ID:                 0xbeef,
		Response:           true,
		OpCode:             0,
		Authoritative:      false,
		Truncated:          false,
		RecursionDesired:   true,
		RecursionAvailable: true,
		RCode:              2,
	}
	if servfail.Header != expectedHeader {
		t.Errorf("Wrong header: %v != %v", servfail.Header, expectedHeader)
	}
	if servfail.Questions[0] != simpleQuery.Questions[0] {
		t.Errorf("Wrong question: %v", servfail.Questions[0])
	}
}
