import {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

export type FormattableMessage =
  | string
  | symbol
  | object
  | PrimitiveType
  | FormatXMLElementFn<symbol | object, string | symbol | object | (string | symbol | object)[]>;

export interface Localizer {
  (messageID: string, ...formatKeyValueList: FormattableMessage[]): string;
}
