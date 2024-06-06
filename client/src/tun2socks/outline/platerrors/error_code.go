// Copyright 2024 The Outline Authors
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

package platerrors

// ErrorCode can be used to identify the specific type of a [PlatformError].
// All possible ErrorCodes are defined as constants in this package.
// You can reliably use these values in TypeScript to check for specific errors.
type ErrorCode string

// Internal error codes

const (
	// GoError represents a general error in Go that is not a [PlatformError].
	// It is typically the last error in the chain of the causes in a [PlatformError].
	// This error code is for internal use only. You should not use it to create a [PlatformError]
	// in your Go code.
	GoError ErrorCode = "ERR_GOLANG_ERROR"

	// InvalidLogic indicates a development mistake that should be identified and
	// corrected during the development process. It should not be expected to occur in production.
	// Typically this error code is for internal use only. You should not use it to create a
	// [PlatformError] in your Go code.
	InvalidLogic ErrorCode = "ERR_INVALID_LOGIC"
)

// Common error codes

const (
	// IllegalArgument indicates that the caller (usually from TypeScript code) passed an
	// illegal argument to a native Go function.
	IllegalArgument ErrorCode = "ERR_ILLEGAL_ARGUMENT"

	// IllegalJSONString means that a string is not a valid JSON string.
	IllegalJSONString ErrorCode = "ERR_ILLEGAL_JSON_STRING"
)

// Common network error codes

const (
	// ResolveIPFailed means that we failed to resolve the IP address of a hostname.
	ResolveIPFailed ErrorCode = "ERR_NET_RESOLVE_IP"
)

// Shadowsocks network error codes

const (
	// SSStreamDialerFailed means we failed to create a Shadowsocks StreamDialer.
	SSStreamDialerFailed ErrorCode = "ERR_SHADOWSOCKS_NEW_STREAM_DIALER"

	// SSPacketListenerFailed means we failed to create a Shadowsocks PacketListener.
	SSPacketListenerFailed ErrorCode = "ERR_SHADOWSOCKS_NEW_PACKET_LISTENER"
)

// Transport config error codes

const (
	IllegalConfigHost     ErrorCode = "ERR_ILLEGAL_CONFIG_HOST"
	IllegalConfigPort     ErrorCode = "ERR_ILLEGAL_CONFIG_PORT"
	IllegalConfigCipher   ErrorCode = "ERR_ILLEGAL_CONFIG_CIPHER"
	IllegalConfigPassword ErrorCode = "ERR_ILLEGAL_CONFIG_PASSWORD"
	IllegalConfigPrefix   ErrorCode = "ERR_ILLEGAL_CONFIG_PREFIX"
)
