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

import { CustomError } from '@outline/infrastructure/custom_error';

//////
// This file defines types and constants corresponding to the backend Go's `platerrors` package.
// It will be used to receive native errors from Go, eventually replacing the older NativeError type.
//////

/**
 * Creates a new {@link PlatformError} of {@link InvalidLogic} representing that we failed to parse
 * PlatformError JSON string, typically this is a development error.
 * @param message The message that will be included in the result.
 * @param rawJSONObj The invalid JSON object that will be included as the details of the result.
 * @returns {PlatformError} A non-null instance of PlatformError.
 */
function newInvalidJSONPlatformError(message: string, rawJSONObj: any): PlatformError {
  return new PlatformError(InvalidLogic, message, { details: { 'json': rawJSONObj } });
}

/**
 * Recursively validates and parses a {@link rawObj} into a {@link PlatformError}.
 *
 * If {@link rawObj} is invalid, a {@link newInvalidJSONPlatformError} will be returned.
 * Otherwise, we will return the parsed {@link PlatformError}.
 * @param {object} rawObj Any object that is returned by JSON.parse.
 * @returns {PlatformError} A non-null instance of PlatformError.
 */
function convertRawErrorObjectToPlatformError(rawObj: object): PlatformError {
  if (!rawObj) {
    return newInvalidJSONPlatformError("error JSON is falsy", rawObj);
  }

  if (!('code' in rawObj) || typeof rawObj.code !== 'string') {
    return newInvalidJSONPlatformError('`code` is not string in error JSON', rawObj);
  }
  const code = rawObj.code.trim();
  if (!code) {
    return newInvalidJSONPlatformError('`code` is empty in error JSON', rawObj);
  }

  if (!('message' in rawObj) || typeof rawObj.message !== 'string') {
    return newInvalidJSONPlatformError('`message` is not string in error JSON', rawObj);
  }

  let options: { details?: object, cause?: Error } = null;
  if ('details' in rawObj || 'cause' in rawObj) {
    options = {};
    if ('details' in rawObj && typeof rawObj.details === 'object' && rawObj.details) {
      options.details = rawObj.details;
    }
    if ('cause' in rawObj && typeof rawObj.cause === 'object' && rawObj.cause) {
      options.cause = convertRawErrorObjectToPlatformError(rawObj.cause);
    }
  }

  return new PlatformError(code, rawObj.message, options);
}

/**
 * PlatformError is used to communicate error details from Go to TypeScript.
 */
export class PlatformError extends CustomError {
  public readonly details: object = null;

  /**
   * Constructs a new PlatformError instance with the specified parameters.
   * @param {ErrorCode} code An ErrorCode representing the category of this error.
   * @param {string} message A user-readable string of this error.
   * @param options An object containing the optional details and cause. 
   */
  constructor(public readonly code: ErrorCode,
    message: string,
    options?: {
      details?: object,
      cause?: Error,
    }) {
    super(message, options);
    this.details = options?.details;
  }

  /**
   * Parses a JSON string into a {@link PlatformError}.
   *
   * If {@link rawJSON} is invalid, it returns a PlatformError of {@link InvalidLogic} with the
   * original JSON in its details.
   * @param {string} rawJSON The JSON string to parse.
   * @returns {PlatformError} A non-null PlatformError object.
   */
  static parseJSON(rawJSON: string): PlatformError {
    let rawObj: unknown;
    try {
      rawObj = JSON.parse(rawJSON);
    } catch {
      return newInvalidJSONPlatformError("invalid error JSON string", rawJSON);
    }
    if (typeof rawObj !== 'object') {
      return newInvalidJSONPlatformError("error JSON is not an object", rawObj);
    }
    return convertRawErrorObjectToPlatformError(rawObj);
  }

  /**
   * Returns a user readable string of this error with all details and causes.
   * @returns {string} A user friendly string representing this error.
   */
  public toString(): string {
    let result = this.code + "\n" + this.message;
    if (this.details) {
      result += "\nDetails: ";
      try {
        result += JSON.stringify(this.details, null, 2);
      } catch {
        result += "<Unable To Show>";
      }
    }
    if (this.cause) {
      const subStr = this.cause.toString();
      // Indent and append
      result += "\nCaused by:\n" + subStr.replace(/^/gm, '  ');
    }
    return result;
  }
}

//////
// Error Code Definitions
// They should be identical to the ones defined in Go's `platerrors` package.
//////

/**
 * ErrorCode can be used to identify the specific type of a {@link PlatformError}.
 * You can reliably use the constant values to check for specific errors.
 */
export type ErrorCode = string;

export const InvalidLogic: ErrorCode = "ERR_INVALID_LOGIC";
export const ServerUnreachable: ErrorCode = "ERR_SERVER_UNREACHABLE";
