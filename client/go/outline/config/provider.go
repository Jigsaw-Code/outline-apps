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
	"fmt"
	"reflect"
)

const (
	// Provider type for nil configs.
	ProviderTypeNil = "nil"
	// Provider type for when an explicit type is missing.
	ProviderTypeDefault = ""
)

const (
	ConfigTypeKey  = "$type"
	ConfigValueKey = "$value"
)

type BuildFunc[ObjectType any] func(ctx context.Context, config ConfigNode) (ObjectType, error)

// TypeRegistry registers config types.
type TypeRegistry[ObjectType any] interface {
	RegisterType(subtype string, newInstance BuildFunc[ObjectType])
}

// ExtensibleProvider creates instances of ObjectType in a way that can be extended via its [TypeRegistry] interface.
type ExtensibleProvider[ObjectType comparable] struct {
	builders map[string]BuildFunc[ObjectType]
}

var (
	_ BuildFunc[any]    = (*ExtensibleProvider[any])(nil).NewInstance
	_ TypeRegistry[any] = (*ExtensibleProvider[any])(nil)
)

// NewExtensibleProvider creates an [ExtensibleProvider].
func NewExtensibleProvider[ObjectType comparable](baseInstance ObjectType) *ExtensibleProvider[ObjectType] {
	p := &ExtensibleProvider[ObjectType]{
		builders: make(map[string]BuildFunc[ObjectType]),
	}
	var zero ObjectType
	if baseInstance != zero {
		p.RegisterType(ProviderTypeNil, func(ctx context.Context, config ConfigNode) (ObjectType, error) { return baseInstance, nil })
	}
	return p
}

func (p *ExtensibleProvider[ObjectType]) ensureBuildersMap() map[string]BuildFunc[ObjectType] {
	if p.builders == nil {
		p.builders = make(map[string]BuildFunc[ObjectType])
	}
	return p.builders
}

// RegisterType will register a factory for the given subtype.
func (p *ExtensibleProvider[ObjectType]) RegisterType(subtype string, newInstance BuildFunc[ObjectType]) {
	p.ensureBuildersMap()[subtype] = newInstance
}

// NewInstance creates a new instance of ObjectType according to the config.
func (p *ExtensibleProvider[ObjectType]) NewInstance(ctx context.Context, config ConfigNode) (ObjectType, error) {
	var zero ObjectType
	var typeName string
	var normConfig any
	switch typed := config.(type) {
	case nil:
		typeName = ProviderTypeNil
		normConfig = nil

	case map[string]any:
		if typeAny, ok := typed[ConfigTypeKey]; ok {
			typeName, ok = typeAny.(string)
			if !ok {
				return zero, fmt.Errorf("subtype must be a string, found %T", typeAny)
			}
		} else {
			typeName = ProviderTypeDefault
		}

		// Value is an explicit field: {$type: ..., $value: ...}.
		var ok bool
		normConfig, ok = typed[ConfigValueKey]
		if ok {
			break
		}

		// $type is embedded in the value: {$type: ..., ...}.
		// Need to copy value and remove the type directive.
		configCopy := make(map[string]any, len(typed))
		for k, v := range typed {
			if len(k) > 0 && k[0] == '$' {
				continue
			}
			configCopy[k] = v
		}
		normConfig = configCopy

	default:
		typeName = reflect.TypeOf(typed).String()
		normConfig = typed
	}

	newInstance, ok := p.ensureBuildersMap()[typeName]
	if !ok {
		return zero, fmt.Errorf("config subtype '%v' is not registered", typeName)
	}
	return newInstance(ctx, normConfig)
}
