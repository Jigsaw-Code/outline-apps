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
	"errors"
	"fmt"
)

type BuildFunc[ObjectType any] func(ctx context.Context, config ConfigNode) (ObjectType, error)

// TypeRegistry registers config types.
type TypeRegistry[ObjectType any] interface {
	RegisterType(subtype string, newInstance BuildFunc[ObjectType])
}

// ExtensibleProvider creates instances of ObjectType in a way that can be extended via its [TypeRegistry] interface.
type ExtensibleProvider[ObjectType comparable] struct {
	// Instance to return when config is nil.
	BaseInstance ObjectType
	builders     map[string]BuildFunc[ObjectType]
}

var (
	_ BuildFunc[any]    = (*ExtensibleProvider[any])(nil).NewInstance
	_ TypeRegistry[any] = (*ExtensibleProvider[any])(nil)
)

// NewExtensibleProvider creates an [ExtensibleProvider] with the given base instance.
func NewExtensibleProvider[ObjectType comparable](baseInstance ObjectType) *ExtensibleProvider[ObjectType] {
	return &ExtensibleProvider[ObjectType]{
		BaseInstance: baseInstance,
		builders:     make(map[string]BuildFunc[ObjectType]),
	}
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
	if config == nil {
		if p.BaseInstance == zero {
			return zero, errors.New("base instance is not configured")
		}
		return p.BaseInstance, nil
	}

	configMap, ok := config.(map[string]any)
	if !ok {
		return zero, fmt.Errorf("config type must be map[string]any, found %T", config)
	}
	subtypeAny, ok := configMap["$type"]
	if !ok {
		return zero, errors.New("subtype missing")
	}
	subtype, ok := subtypeAny.(string)
	if !ok {
		return zero, fmt.Errorf("subtype must be a string, found %T", subtypeAny)
	}
	newInstance, ok := p.ensureBuildersMap()[subtype]
	if !ok {
		return zero, fmt.Errorf("config subtype '%v' is not registered", subtype)
	}
	return newInstance(ctx, config)
}
