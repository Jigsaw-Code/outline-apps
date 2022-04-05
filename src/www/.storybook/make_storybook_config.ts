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
  containerName?: string;
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
  {controls, containerName}: StorybookConfigOptions
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
