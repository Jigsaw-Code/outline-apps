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
	"golang.org/x/net/dns/dnsmessage"
)

const (
	OptResourcePaddingCode = 12
	PaddingBlockSize       = 128 // RFC8467 recommendation
)

const kOptRrHeaderLen int = 1 + // DOMAIN NAME
	2 + // TYPE
	2 + // CLASS
	4 + // TTL
	2 // RDLEN

const kOptPaddingHeaderLen int = 2 + // OPTION-CODE
	2 // OPTION-LENGTH

// Compute the number of padding bytes needed, excluding headers.
// Assumes that |msgLen| is the length of a raw DNS message that contains an
// OPT RR with no RFC7830 padding option, and that the message is fully
// label-compressed.
func computePaddingSize(msgLen int, blockSize int) int {
	// We'll always be adding a new padding header inside the OPT
	// RR's data.
	extraPadding := kOptPaddingHeaderLen

	padSize := blockSize - (msgLen+extraPadding)%blockSize
	return padSize % blockSize
}

// Create an appropriately-sized padding option. Precondition: |msgLen| is the
// length of a message that already contains an OPT RR.
func getPadding(msgLen int) dnsmessage.Option {
	optPadding := dnsmessage.Option{
		Code: OptResourcePaddingCode,
		Data: make([]byte, computePaddingSize(msgLen, PaddingBlockSize)),
	}
	return optPadding
}

// Add EDNS padding, as defined in RFC7830, to a raw DNS message.
func AddEdnsPadding(rawMsg []byte) ([]byte, error) {
	var msg dnsmessage.Message
	if err := msg.Unpack(rawMsg); err != nil {
		return nil, err
	}

	// Search for OPT resource and save |optRes| pointer if possible.
	var optRes *dnsmessage.OPTResource = nil
	for _, additional := range msg.Additionals {
		switch body := additional.Body.(type) {
		case *dnsmessage.OPTResource:
			optRes = body
			break
		}
	}
	if optRes != nil {
		// Search for a padding Option. If the message already contains
		// padding, we will respect the stub resolver's padding.
		for _, option := range optRes.Options {
			if option.Code == OptResourcePaddingCode {
				return rawMsg, nil
			}
		}
		// At this point, |optRes| points to an OPTResource that does
		// not contain a padding option.
	} else {
		// Create an empty OPTResource (contains no padding option) and
		// push it into |msg.Additionals|.
		optRes = &dnsmessage.OPTResource{
			Options: []dnsmessage.Option{},
		}

		optHeader := dnsmessage.ResourceHeader{}
		// SetEDNS0(udpPayloadLen int, extRCode RCode, dnssecOK bool) error
		err := optHeader.SetEDNS0(65535, dnsmessage.RCodeSuccess, false)
		if err != nil {
			return nil, err
		}

		msg.Additionals = append(msg.Additionals, dnsmessage.Resource{
			Header: optHeader,
			Body:   optRes,
		})
	}
	// At this point, |msg| contains an OPT resource, and that OPT resource
	// does not contain a padding option.

	// Compress the message to determine its size before padding.
	compressedMsg, err := msg.Pack()
	if err != nil {
		return nil, err
	}
	// Add the padding option to |msg| that will round its size on the wire
	// up to the nearest block.
	paddingOption := getPadding(len(compressedMsg))
	optRes.Options = append(optRes.Options, paddingOption)

	// Re-pack the message, with compression unconditionally enabled.
	return msg.Pack()
}
