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
	"bytes"
	"context"
	"fmt"

	"gopkg.in/yaml.v3"
)

const ConfigParserKey = "$parser"

type ConfigNode any

type ParseFunc[OutputType any] func(ctx context.Context, input ConfigNode) (OutputType, error)

func ParseConfigYAML(configText string) (ConfigNode, error) {
	var node any
	if err := yaml.Unmarshal([]byte(configText), &node); err != nil {
		return nil, err
	}
	return node, nil
}

func mapToAny(in map[string]any, out any) error {
	newMap := make(map[string]any)
	for k, v := range in {
		if len(k) > 0 && k[0] == '$' {
			// Skip $ keys
			continue
		}
		newMap[k] = v
	}
	yamlText, err := yaml.Marshal(newMap)
	if err != nil {
		return err
	}
	decoder := yaml.NewDecoder(bytes.NewReader(yamlText))
	decoder.KnownFields(true)
	return decoder.Decode(out)
}

// TypeParser creates objects of the given type T from an input config.
// You can register type-specific sub-parsers that get called when marked in the config.
// The default value is not valid. Use [NewTypeParser] instead.
type TypeParser[T any] struct {
	fallbackHandler ParseFunc[T]
	subparsers      map[string]func(context.Context, map[string]any) (T, error)
}

var _ ParseFunc[any] = (*TypeParser[any])(nil).Parse

func NewTypeParser[T any](fallbackHandler func(context.Context, ConfigNode) (T, error)) *TypeParser[T] {
	return &TypeParser[T]{
		fallbackHandler: fallbackHandler,
		subparsers:      make(map[string]func(context.Context, map[string]any) (T, error)),
	}
}

func (p *TypeParser[T]) Parse(ctx context.Context, config ConfigNode) (T, error) {
	var zero T

	// Iterate while the input is a function call.
	for {
		inMap, ok := config.(map[string]any)
		if !ok {
			break
		}
		parserNameAny, ok := inMap[ConfigParserKey]
		if !ok {
			break
		}
		parserName, ok := parserNameAny.(string)
		if !ok {
			return zero, fmt.Errorf("parser name must be a string, found \"%T\"", parserNameAny)
		}
		parser, ok := p.subparsers[parserName]
		if !ok {
			return zero, fmt.Errorf("provider \"%v\" for type %T is not registered", parserName, zero)
		}

		// $parser is embedded in the value: {$parser: ..., ...}.
		// Need to copy value and remove the type directive.
		inputCopy := make(map[string]any, len(inMap))
		for k, v := range inMap {
			if k == ConfigParserKey {
				continue
			}
			inputCopy[k] = v
		}

		var err error
		config, err = parser(ctx, inputCopy)
		if err != nil {
			return zero, fmt.Errorf("parser \"%v\" failed: %w", parserName, err)
		}
	}

	typed, ok := config.(T)
	if ok {
		return typed, nil
	}

	// Input is an intermediate type. We need a fallback handler.
	return p.fallbackHandler(ctx, config)
}

func (p *TypeParser[T]) RegisterSubParser(name string, function func(context.Context, map[string]any) (T, error)) {
	p.subparsers[name] = function
}