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

package configyaml

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/Jigsaw-Code/outline-sdk/transport"
	"github.com/goccy/go-yaml"
	"github.com/goccy/go-yaml/ast"
	"github.com/stretchr/testify/require"
)

func parseShadowsocksString(config string) (transport.StreamDialer, error) {
	return transport.FuncStreamDialer(func(ctx context.Context, addr string) (transport.StreamConn, error) {
		return nil, nil
	}), nil
}

type shadowsocksConfig[EndpointType any] struct {
	Endpoint EndpointType
	Cipher   string
	Secret   string
}

func TestParse(t *testing.T) {
	newShadowsocksStreamDialer := func(ctx context.Context, config shadowsocksConfig[transport.StreamEndpoint]) (transport.StreamDialer, error) {
		require.NotNil(t, config.Endpoint)
		require.IsType(t, (*transport.StreamDialerEndpoint)(nil), config.Endpoint)
		require.Equal(t, "chacha20-poly1305", config.Cipher)
		require.Equal(t, "SECRET", config.Secret)
		return transport.FuncStreamDialer(func(ctx context.Context, addr string) (transport.StreamConn, error) {
			if config.Endpoint != nil && config.Cipher == "chacha20-poly1305" && config.Secret == "SECRET" {
				return nil, nil
			}
			return nil, errors.New("bad input")
		}), nil
	}

	var parseSE ParseFunc[transport.StreamEndpoint] = func(ctx context.Context, config []byte) (transport.StreamEndpoint, error) {
		var node ast.Node
		if err := yaml.UnmarshalContext(ctx, config, &node); err != nil {
			return nil, err
		}
		switch typed := node.(type) {
		case *ast.StringNode:
			require.Equal(t, "example.com:443", typed.Value)
			return &transport.StreamDialerEndpoint{Address: typed.Value}, nil

		default:
			return nil, errors.ErrUnsupported
		}
	}

	// var parseSD typeParser
	// parseSD.RegisterStringParser(...)
	// parseSD.RegisterMapParser("shadowsocks", ...)
	var parseSD ParseFunc[transport.StreamDialer] = func(ctx context.Context, config []byte) (transport.StreamDialer, error) {
		var node ast.Node
		if err := yaml.UnmarshalContext(ctx, config, &node); err != nil {
			return nil, err
		}
		switch typed := node.(type) {
		case *ast.StringNode:
			return parseShadowsocksString(typed.Value)

		case *ast.MappingNode:
			subType := ""
			cleanValues := make([]*ast.MappingValueNode, 0, len(typed.Values))
			for iter := typed.MapRange(); iter.Next(); {
				switch iter.Key().String() {
				case ConfigTypeKey:
					subType = iter.Value().String()
				default:
					cleanValues = append(cleanValues, iter.KeyValue())
				}
			}
			typed.Values = cleanValues
			switch subType {
			case "":
				// If $type is missing, assume shadowsocks.
				sd, err := ConfigNodeToOutput(ctx, typed, newShadowsocksStreamDialer, WithTypeParser(parseSE))
				if err != nil {
					return nil, fmt.Errorf("%v missing and failed to parse as shadowsocks: %w", ConfigTypeKey, err)
				}
				return sd, nil
			case "shadowsocks":
				// TODO: use registration and hide ParseWithConfig.
				// Something like:
				// sdParser.RegisterType("shadowsocks", newShadowsocksStreamDialer, WithTypeParser(seParser))
				// Generic with InputType and OutputType
				return ConfigNodeToOutput(ctx, typed, newShadowsocksStreamDialer, WithTypeParser(parseSE))
			default:
				return nil, fmt.Errorf("type %v not supported: %w", subType, errors.ErrUnsupported)
			}

		default:
			return nil, errors.ErrUnsupported
		}
	}
	// TODO: register ssParser with sdParser as subtype "shadowsocks"
	// sdParser.RegisterSubtype("shadowsocks", ssParser)
	config := []byte(`
$type: shadowsocks
endpoint: example.com:443
cipher: chacha20-poly1305
secret: SECRET`)
	// config := []byte(`ss://foo`)

	sd, err := parseSD(context.Background(), config)
	require.NoError(t, err)
	require.NotNil(t, sd)
}

type InterfaceConfig struct {
	Type  string   `yaml:"$type"`
	Value ast.Node `yaml:"$value"`
	// InlineValue map[string]any `yaml:",inline"`
}

func TestParse2(t *testing.T) {
	var fakeDialer transport.StreamDialer = transport.FuncStreamDialer(func(ctx context.Context, addr string) (transport.StreamConn, error) {
		return nil, errors.ErrUnsupported
	})

	newStreamEndpointFromConfig := func(ctx context.Context, input string) (transport.StreamEndpoint, error) {
		require.Equal(t, "example.com:443", input)
		return &transport.StreamDialerEndpoint{Address: input}, nil
	}
	// Replace with NewInterfaceParser()
	parseSE := NewConfigParser(newStreamEndpointFromConfig)

	newShadowsocksStreamDialerFromConfig := func(ctx context.Context, input shadowsocksConfig[transport.StreamEndpoint]) (transport.StreamDialer, error) {
		require.Equal(t, "chacha20-poly1305", input.Cipher)
		require.Equal(t, "SECRET", input.Secret)
		return fakeDialer, nil
	}
	parseShadowsocksStreamDialer := NewConfigParser(newShadowsocksStreamDialerFromConfig, WithTypeParser(parseSE))

	newStreamDialerFromConfig := func(ctx context.Context, input InterfaceConfig) (transport.StreamDialer, error) {
		value := input.Value
		// if value == nil {
		// 	value = input.InlineValue
		// }
		var valueYaml []byte
		if value != nil {
			var err error
			valueYaml, err = yaml.MarshalContext(ctx, value)
			if err != nil {
				return nil, fmt.Errorf("invalid value. failed to format: %w", err)
			}
		}
		switch input.Type {
		case "shadowsocks":
			return parseShadowsocksStreamDialer(ctx, valueYaml)

		default:
			return nil, errors.ErrUnsupported
		}
	}
	parseSD := NewConfigParser(newStreamDialerFromConfig)

	streamDialer, err := parseSD(context.Background(), []byte(`
$type: shadowsocks
endpoint: example.com:443
cipher: chacha20-poly1305
secret: SECRET`))

	require.NoError(t, err)
	// Compare the addresses, since we can't compare functions in Go.
	require.Equal(t, fmt.Sprintf("%v", fakeDialer), fmt.Sprintf("%v", streamDialer))
}

/*
type TestStruct struct {
	Field1 string
	Field2 int
}

func TestMapToAny_Empty(t *testing.T) {
	var s TestStruct
	require.NoError(t, MapToAny(map[string]any{}, &s))
	require.Zero(t, s)
}

func TestMapToAny_Fields(t *testing.T) {
	var s TestStruct
	require.NoError(t, MapToAny(map[string]any{
		"field1": "value1",
	}, &s))
	require.Equal(t, TestStruct{Field1: "value1"}, s)

	s = TestStruct{}
	require.NoError(t, MapToAny(map[string]any{
		"field2": 2,
	}, &s))
	require.Equal(t, TestStruct{Field2: 2}, s)

	s = TestStruct{}
	require.NoError(t, MapToAny(map[string]any{
		"field1": "value1",
		"field2": 2,
	}, &s))
	require.Equal(t, TestStruct{Field1: "value1", Field2: 2}, s)
}

func TestMapToAny_InvalidType(t *testing.T) {
	var s TestStruct
	require.Error(t, MapToAny(map[string]any{
		"field2": "should be int, not string",
	}, &s))
}

func TestMapToAny_CoercesIntToString(t *testing.T) {
	var s TestStruct
	// Not sure this is desirable, but it's how the library works.
	// This test is intended to document the behavior.
	require.NoError(t, MapToAny(map[string]any{
		"field1": 10,
	}, &s))
	require.Equal(t, TestStruct{Field1: "10"}, s)
}

func TestMapToAny_UnknownField(t *testing.T) {
	var s TestStruct
	require.Error(t, MapToAny(map[string]any{
		"field3": "value3",
	}, &s))
}

// func TestParse_Subtype(t *testing.T) {
// 	type TypeB interface {
// 		IsValid() bool
// 	}
// 	type typeB struct {}
// 	func (*typeB) IsValid() bool {
// 		return true
// 	}

// 	type TypeA struct {
// 		Field1 string
// 		Field2 TypeB
// 	}
// 	parseB := func(v1 string, v2 int) ExampleType {
// 		return ExampleType{Field1: v1, Field2: v2}
// 	}
// 	config = []byte(`

// 	`)
// 	yaml.UnmarshalContext(context.Background([]byte())
// )
// 	var s TestStruct
// 	require.Error(t, MapToAny(map[string]any{
// 		"field3": "value3",
// 	}, &s))
// }
*/
