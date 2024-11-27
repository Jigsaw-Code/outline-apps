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

import {CustomError} from '@outline/infrastructure/custom_error';

/**
 * @fileoverview This file defines types and constants corresponding to the backend Go's
 * `platerrors` package. It will be used to receive native errors from Go, eventually replacing
 * the older NativeError type.
 */

/**
 * Creates a new {@link PlatformError} instance with the error code set to {@link INTERNAL_ERROR}.
 * @param cause An optional cause of this error.
 * @returns A non-null instance of {@link PlatformError}.
 */
function createInternalError(cause?: unknown): PlatformError {
  const MESSAGE = 'Internal service error';

  if (typeof cause === 'undefined' || cause === null) {
    return new PlatformError(INTERNAL_ERROR, MESSAGE);
  } else if (cause instanceof Error) {
    return new PlatformError(INTERNAL_ERROR, MESSAGE, {cause});
  }

  // Use String(cause) instead of cause.toString() or new String(cause) to cover
  // primitive types and Symbols.
  return new PlatformError(INTERNAL_ERROR, MESSAGE, {
    cause: new Error(String(cause)),
  });
}

/**
 * Recursively validates and parses a {@link rawObj} into a {@link PlatformError}.
 * @param {object} rawObj Any object that is returned by JSON.parse.
 * @returns {PlatformError} A non-null instance of PlatformError.
 * @throws {Error} Will be thrown when {@link rawObj} is invalid.
 */
function convertRawErrorObjectToPlatformError(rawObj: object): PlatformError {
  if (!('code' in rawObj) || typeof rawObj.code !== 'string') {
    throw new Error('code is invalid');
  }
  const code = rawObj.code.trim();
  if (!code) {
    throw new Error('code is empty');
  }
  if (!('message' in rawObj) || typeof rawObj.message !== 'string') {
    throw new Error('message is invalid');
  }

  const options: {details?: ErrorDetails; cause?: Error} = {};
  if ('details' in rawObj) {
    if (typeof rawObj.details !== 'object') {
      throw new Error('details is invalid');
    }
    if (rawObj.details) {
      options.details = <ErrorDetails>rawObj.details;
    }
  }
  if ('cause' in rawObj) {
    if (typeof rawObj.cause !== 'object') {
      throw new Error('cause is invalid');
    }
    if (rawObj.cause) {
      options.cause = convertRawErrorObjectToPlatformError(rawObj.cause);
    }
  }

  return new PlatformError(code, rawObj.message, options);
}

/**
 * Recursively converts a {@link PlatformError} into a raw JavaScript object that
 * could be converted into a JSON string.
 * @param {PlatformError} platErr Any non-null PlatformError.
 * @returns {object} A plain JavaScript object that can be converted to JSON.
 */
function convertPlatformErrorToRawErrorObject(platErr: PlatformError): object {
  const rawObj: {
    code: string;
    message: string;
    details?: ErrorDetails;
    cause?: object;
  } = {
    code: platErr.code,
    message: platErr.message,
    details: platErr.details,
  };
  if (platErr.cause) {
    let cause: PlatformError;
    if (platErr.cause instanceof PlatformError) {
      cause = platErr.cause;
    } else {
      cause = new PlatformError(INTERNAL_ERROR, String(platErr.cause));
    }
    rawObj.cause = convertPlatformErrorToRawErrorObject(cause);
  }
  return rawObj;
}

/**
 * ErrorDetails represents the details map of a {@link PlatformError}.
 * The keys in this map are strings, and the values can be of any data type.
 */
export type ErrorDetails = {[key: string]: unknown};

/**
 * PlatformError is used to communicate error details from Go to TypeScript.
 */
export class PlatformError extends CustomError {
  readonly details?: ErrorDetails = null;

  /**
   * Constructs a new PlatformError instance with the specified parameters.
   * @param {ErrorCode} code An ErrorCode representing the category of this error.
   * @param {string} message A user-readable string of this error.
   * @param options An object containing the optional details and cause.
   */
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: {
      details?: ErrorDetails;
      cause?: Error;
    }
  ) {
    super(message, options);
    this.details = options?.details;
  }

  /**
   * Parses a cross-component-boundary error object into a {@link PlatformError}.
   *
   * The error object can be one of the following types:
   * - A raw JSON string representation of a PlatformError.
   * - An Error whose message is a raw JSON string representation of a PlatformError.
   * - Otherwise, an {@link INTERNAL_ERROR} {@link PlatformError} with {@link errObj} as its cause
   *   will be returned.
   *
   * @param errObj The error object to be parsed.
   * @returns A non-null PlatformError object.
   *
   * @example
   * try {
   *   // cordova plugin calls or electron IPC calls
   * } catch (e) {
   *   throw PlatformError.parseFrom(e);
   * }
   */
  static parseFrom(errObj: string | Error | unknown): PlatformError {
    if (typeof errObj === 'undefined' || errObj === null) {
      return createInternalError();
    }
    if (errObj instanceof PlatformError) {
      return errObj;
    }

    let rawJSON: string;
    let rawObj: object;
    if (typeof errObj === 'string') {
      rawJSON = errObj;
    } else if (errObj instanceof Error) {
      rawJSON = errObj.message;
    } else if (typeof errObj === 'object') {
      rawObj = errObj;
    } else {
      return createInternalError(errObj);
    }

    if (rawJSON) {
      try {
        rawObj = JSON.parse(rawJSON);
      } catch {
        return createInternalError(errObj);
      }
    }

    if (typeof rawObj !== 'object' || !rawObj) {
      return createInternalError(errObj);
    }
    try {
      return convertRawErrorObjectToPlatformError(rawObj);
    } catch {
      return createInternalError(errObj);
    }
  }

  /**
   * Returns a user readable string of this error with all details and causes.
   * @returns {string} A user friendly string representing this error.
   */
  toString(): string {
    let result = this.code + '\n' + this.message;
    if (this.details) {
      result += '\nDetails: ';
      try {
        result += JSON.stringify(this.details, null, 2);
      } catch {
        result += '<Unable To Show>';
      }
    }
    if (this.cause) {
      // Indent and append
      result += '\nCaused by:\n' + String(this.cause).replace(/^/gm, '  ');
    }
    return result;
  }

  /**
   * Returns a JSON string of this error with all details and causes.
   * @returns {string} The JSON string representing this error.
   */
  toJSON(): string {
    const errRawObj = convertPlatformErrorToRawErrorObject(this);
    return JSON.stringify(errRawObj);
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

export const INTERNAL_ERROR: ErrorCode = 'ERR_INTERNAL_ERROR';

export const FETCH_CONFIG_FAILED: ErrorCode = 'ERR_FETCH_CONFIG_FAILURE';
export const ILLEGAL_CONFIG: ErrorCode = 'ERR_ILLEGAL_CONFIG';

export const VPN_PERMISSION_NOT_GRANTED = 'ERR_VPN_PERMISSION_NOT_GRANTED';

export const PROXY_SERVER_UNREACHABLE: ErrorCode =
  'ERR_PROXY_SERVER_UNREACHABLE';

/** Indicates that the OS routing service is not running (electron only). */
export const ROUTING_SERVICE_NOT_RUNNING = 'ERR_ROUTING_SERVICE_NOT_RUNNING';
