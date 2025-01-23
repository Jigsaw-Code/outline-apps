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

import * as errors from './errors';

// TODO(fortuna): Remove PlatformError from the model.
// PlatformError is an implementation detail. It does not belong in the model.
// It's also about serialization, we should not use it in application code.

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
function createInternalError(cause?: unknown): Error {
  const MESSAGE = 'Internal service error';

  if (typeof cause === 'undefined' || cause === null) {
    return new Error(MESSAGE);
  } else if (cause instanceof Error) {
    return new Error(MESSAGE, {cause});
  }

  // Use String(cause) instead of cause.toString() or new String(cause) to cover
  // primitive types and Symbols.
  return new Error(MESSAGE, {
    cause: new Error(String(cause)),
  });
}

/**
 * Recursively validates and parses a {@link rawObj} into a {@link PlatformError}.
 * @param {object} rawObj Any object that is returned by JSON.parse.
 * @returns {Error} A non-null instance of PlatformError.
 * @throws {Error} Will be thrown when {@link rawObj} is invalid.
 */
function convertRawErrorObjectToError(rawObj: object): Error {
  if (!('code' in rawObj) || typeof rawObj.code !== 'string') {
    throw new Error('code is invalid');
  }
  const code = rawObj.code.trim() as GoErrorCode;
  if (!code) {
    throw new Error('code is empty');
  }
  if (!('message' in rawObj) || typeof rawObj.message !== 'string') {
    throw new Error('message is invalid');
  }

  let detailsMessage = rawObj.message;
  if ('details' in rawObj) {
    if (typeof rawObj.details !== 'object') {
      throw new Error('details is invalid');
    }
    if (rawObj.details) {
      detailsMessage = makeDetailsString(
        rawObj.message,
        <ErrorDetails>rawObj.details
      );
    }
  }
  let cause: Error;
  if ('cause' in rawObj) {
    if (typeof rawObj.cause !== 'object') {
      throw new Error('cause is invalid');
    }
    if (rawObj.cause) {
      cause = convertRawErrorObjectToError(rawObj.cause);
    }
  }

  switch (code) {
    case GoErrorCode.ILLEGAL_CONFIG:
      return new errors.ServerAccessKeyInvalid(detailsMessage, {cause});
    case GoErrorCode.PROXY_SERVER_UNREACHABLE:
      return new errors.ServerUnreachable(detailsMessage, {cause});
    case GoErrorCode.VPN_PERMISSION_NOT_GRANTED:
      return new errors.VpnPermissionNotGranted(detailsMessage, {cause});
    default: {
      const error = new Error(detailsMessage, {cause});
      error.name = code;
      return error;
    }
  }
}

/**
 * Recursively converts a {@link PlatformError} into a raw JavaScript object that
 * could be converted into a JSON string.
 * @param {PlatformError} platErr Any non-null PlatformError.
 * @returns {object} A plain JavaScript object that can be converted to JSON.
 */
// function makeIpcErrorJson(
//   code: GoErrorCode,
//   details: string,
//   options?: {
//     details?: ErrorDetails;
//     cause?: object;
//   }
// ): object {
//   return {};
//   const rawObj: {
//     code: string;
//     message: string;
//     details?: ErrorDetails;
//     cause?: object;
//   } = {
//     code: platErr.code,
//     message: platErr.message,
//     details: platErr.details,
//   };
//   if (platErr.cause) {
//     let cause: PlatformError;
//     if (platErr.cause instanceof PlatformError) {
//       cause = platErr.cause;
//     } else {
//       cause = new PlatformError(
//         GoErrorCode.INTERNAL_ERROR,
//         String(platErr.cause)
//       );
//     }
//     rawObj.cause = convertPlatformErrorToRawErrorObject(cause);
//   }
//   return rawObj;
// }

/**
//  * Serializes the platform error so it can be sent over an IPC from Electron main to the renderer code.
//  * @param platErr
//  * @returns
//  */
// export function makeIpcError(errorJson: {
//   code: GoErrorCode;
//   details: string;
//   options?: {
//     details?: ErrorDetails;
//     cause?: object;
//   };
// }): object {
//   return JSON.stringify(errorJson);
// }

/**
 * ErrorDetails represents the details map of a {@link PlatformError}.
 * The keys in this map are strings, and the values can be of any data type.
 */
export type ErrorDetails = {[key: string]: unknown};

/**
 * PlatformError is used to communicate error details from Go to TypeScript.
 */
export class PlatformError extends CustomError {
  details?: ErrorDetails = null;

  /**
   * Constructs a new PlatformError instance with the specified parameters.
   * @param {GoErrorCode} code An ErrorCode representing the category of this error.
   * @param {string} message A user-readable string of this error.
   * @param options An object containing the optional details and cause.
   */
  constructor(
    code: GoErrorCode,
    message: string,
    options?: {
      details?: ErrorDetails;
      cause?: Error;
    }
  ) {
    if (options?.details) {
      message = `${message}\nDetails: ${JSON.stringify(options?.details, null, 2)}`;
    }
    super(message, {cause: options.cause});
    this.name = code;
  }

  // /**
  //  * Returns a user readable string of this error with all details and causes.
  //  * @returns {string} A user friendly string representing this error.
  //  */
  // toString(): string {
  //   let result = '';
  //   if (this.code === GoErrorCode.GENERIC_ERROR) {
  //     result = this.message;
  //   } else {
  //     result = this.code + '\n' + this.message;
  //   }
  //   if (this.details) {
  //     result += '\nDetails: ';
  //     try {
  //       result += JSON.stringify(this.details, null, 2);
  //     } catch {
  //       result += '<Unable To Show>';
  //     }
  //   }
  //   if (this.cause) {
  //     // Indent and append
  //     result += '\nCaused by:\n' + String(this.cause).replace(/^/gm, '  ');
  //   }
  //   return result;
  // }
}

function makeDetailsString(
  detailsMessage?: string,
  detailsMap?: object
): string {
  let result = detailsMessage;
  if (detailsMap) {
    result += '\nDetails: ';
    try {
      result += JSON.stringify(detailsMap, null, 2);
    } catch {
      result += '<Unable To Show>';
    }
  }
  return result;
}

/**
 * Parses a cross-component-boundary error object into an {@link Error}.
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
export function parseErrorFromIpc(ipcError: unknown): Error {
  if (typeof ipcError === 'undefined' || ipcError === null) {
    return createInternalError();
  }
  let rawJSON: string;
  let rawObj: object;
  if (typeof ipcError === 'string') {
    rawJSON = ipcError;
  } else if (ipcError instanceof Error) {
    rawJSON = ipcError.message;
  } else if (typeof ipcError === 'object') {
    rawObj = ipcError;
  } else {
    return createInternalError(ipcError);
  }

  if (rawJSON) {
    try {
      rawObj = JSON.parse(rawJSON);
    } catch {
      return createInternalError(ipcError);
    }
  }

  if (typeof rawObj !== 'object' || !rawObj) {
    return createInternalError(ipcError);
  }
  try {
    return convertRawErrorObjectToError(rawObj);
  } catch {
    return createInternalError(ipcError);
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
export enum GoErrorCode {
  // Generic error, usually used as a cause for an application error. Use it, unless the
  // Go backend needs to throw application errors.
  GENERIC_ERROR = 'ERR_GENERIC',

  INTERNAL_ERROR = 'ERR_INTERNAL_ERROR',
  ILLEGAL_CONFIG = 'ERR_ILLEGAL_CONFIG',
  VPN_PERMISSION_NOT_GRANTED = 'ERR_VPN_PERMISSION_NOT_GRANTED',
  PROXY_SERVER_UNREACHABLE = 'ERR_PROXY_SERVER_UNREACHABLE',
  /** Indicates that the OS routing service is not running (electron only). */
  ROUTING_SERVICE_NOT_RUNNING = 'ERR_ROUTING_SERVICE_NOT_RUNNING',
}
