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

package config

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseShadowsocksURLFullyEncoded(t *testing.T) {
	encoded := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString([]byte("aes-256-gcm:1234567@example.com:1234?prefix=HTTP%2F1.1%20"))
	config, err := parseShadowsocksConfig("ss://" + string(encoded) + "#outline-123")
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
	require.Equal(t, "HTTP/1.1 ", config.Prefix)
}

func TestParseShadowsocksURLUserInfoEncoded(t *testing.T) {
	encoded := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString([]byte("aes-256-gcm:1234567"))
	config, err := parseShadowsocksConfig("ss://" + string(encoded) + "@example.com:1234?prefix=HTTP%2F1.1%20" + "#outline-123")
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
	require.Equal(t, "HTTP/1.1 ", config.Prefix)
}

func TestParseShadowsocksURLUserInfoLegacyEncoded(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("aes-256-gcm:shadowsocks"))
	config, err := parseShadowsocksConfig("ss://" + string(encoded) + "@example.com:1234?prefix=HTTP%2F1.1%20" + "#outline-123")
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
	require.Equal(t, "HTTP/1.1 ", config.Prefix)
}

func TestLegacyEncodedShadowsocksURL(t *testing.T) {
	configString := "ss://YWVzLTEyOC1nY206c2hhZG93c29ja3M=@example.com:1234"
	config, err := parseShadowsocksConfig(configString)
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
}

func TestParseShadowsocksURLNoEncoding(t *testing.T) {
	configString := "ss://aes-256-gcm:1234567@example.com:1234"
	config, err := parseShadowsocksConfig(configString)
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
}

func TestParseShadowsocksURLInvalidCipherInfoFails(t *testing.T) {
	configString := "ss://aes-256-gcm1234567@example.com:1234"
	_, err := newShadowsocksParams(configString)
	require.Error(t, err)
}

func TestParseShadowsocksURLUnsupportedCypherFails(t *testing.T) {
	configString := "ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwnTpLeTUyN2duU3FEVFB3R0JpQ1RxUnlT@example.com:1234"
	_, err := newShadowsocksParams(configString)
	require.Error(t, err)
}

func TestParseShadowsocksLegacyBase64URL(t *testing.T) {
	encoded := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString([]byte("aes-256-gcm:1234567@example.com:1234?prefix=HTTP%2F1.1%20"))
	config, err := parseShadowsocksConfig("ss://" + string(encoded) + "#outline-123")
	require.NoError(t, err)
	require.Equal(t, "example.com:1234", config.Endpoint.(DialEndpointConfig).Address)
	require.Equal(t, "HTTP/1.1 ", config.Prefix)
}
