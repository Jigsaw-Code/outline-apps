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
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// TODO:
// - Backward-compatibility
//   - Introduce GenericDialer? May need logic specific to dialers, like fallback to Shadowsocks if type is missing.
// - Port tests to new API
// - Websocket endpoint POC

func TestRegisterDefaultProviders(t *testing.T) {
	providers := RegisterDefaultProviders(NewProviderContainer())

	node, err := ParseConfigYAML(`
$type: ss
endpoint: example.com:1234
cipher: chacha20-ietf-poly1305
secret: SECRET`)
	require.NoError(t, err)

	d, err := providers.StreamDialers.NewInstance(context.Background(), node)
	require.NoError(t, err)

	require.NotNil(t, d.StreamDialer)
	require.Equal(t, "example.com:1234", d.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.ConnType)
}

func TestRegisterParseURL(t *testing.T) {
	providers := RegisterDefaultProviders(NewProviderContainer())

	node, err := ParseConfigYAML(`ss://Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpaTXJSMW92ZmRBaEQ@example.com:4321/#My%20Server`)
	require.NoError(t, err)

	d, err := providers.StreamDialers.NewInstance(context.Background(), node)
	require.NoError(t, err)

	require.NotNil(t, d.StreamDialer)
	require.Equal(t, "example.com:4321", d.FirstHop)
	require.Equal(t, ConnTypeTunneled, d.ConnType)
}
