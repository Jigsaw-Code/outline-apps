import {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';

export type FormattableMessage =
  | string
  | symbol
  | object
  | PrimitiveType
  | FormatXMLElementFn<symbol | object, string | symbol | object | (string | symbol | object)[]>;

export interface LocalizeFunc {
  (messageID: string, ...formatKeyValueList: FormattableMessage[]): string;
}
