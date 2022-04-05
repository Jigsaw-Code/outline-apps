/*
  Copyright 2022 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

interface StorybookGenericControl<T> {
  defaultValue?: T;
  controlName: string;
}

interface StorybookTextControl extends StorybookGenericControl<string> {
  controlType: "text" | "color" | "date";
}

interface StorybookObjectControl extends StorybookGenericControl<object> {
  controlType: "object";
}

interface StorybookSelectControl extends StorybookGenericControl<string | number | string[] | number[]> {
  controlType: "radio" | "inline-radio" | "check" | "inline-check" | "select" | "multi-select";
  options: string[] | number[];
}

interface StorybookBooleanControl extends StorybookGenericControl<boolean> {
  controlType: "boolean";
}

export type StorybookControl =
  | StorybookTextControl
  | StorybookSelectControl
  | StorybookObjectControl
  | StorybookBooleanControl;

interface StorybookConfigOptions {
  containerPath?: string;
  controls: StorybookControl[];
}

interface StorybookConfig {
  name: string;
  component: string;
  args: {[argName: string]: string | object | boolean | number | string[] | number[]};
  argTypes: {[argName: string]: {control: string; options: []}};
}

export function makeStorybookConfig(
  Component: CustomElementConstructor & {is: string},
  {controls, containerPath: containerName}: StorybookConfigOptions
): StorybookConfig {
  const componentName = Component.constructor.name;

  const result: StorybookConfig = {
    name: containerName ? `${containerName}/${componentName}` : componentName,
    component: Component.is,
    args: {},
    argTypes: {},
  };

  for (const {controlName, controlType, defaultValue, options} of controls) {
    result.args[controlName] = defaultValue;
    result.argTypes[controlName] = {control: controlType, options};
  }

  return result;
}
