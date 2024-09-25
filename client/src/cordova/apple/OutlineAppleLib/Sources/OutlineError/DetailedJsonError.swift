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

import Foundation // For NSError type
import Tun2socks  // For platerrors ErrorCode strings

/// Defines keys used in the userInfo of a NSError.
private enum DetailedJsonErrorKeys {
  static let Code: String = "DetailedJsonErrorCode"
  static let ErrorJson: String  = "DetailedJsonErrorDetails"
}

/// An error type representing an error with a code and a JSON string containing detailed information.
public class DetailedJsonError: Error {
  private let code: String
  private let json: String

  /// Create a new DetailedJsonError with a specified error code string and details in JSON.
  public init(withErrorCode code: String, andErrorJson json: String) {
    self.code = code
    self.json = json
  }

  /// Create a new DetailedJsonError with a specified error code string and message.
  /// It will marshal the error code and message into detailed JSON.
  /// We reuse Go's PlatformError to reduce the duplication of the JSON marshalling logic in Swift.
  public static func from(errorCode code: String, andMessage message: String) -> DetailedJsonError {
    /// This definitions should be in sync with the one in platform_error.go.
    struct ErrorJSONObject: Codable {
      let code: String
      let message: String
    }

    let errObj = ErrorJSONObject(code: code, message: message)
    guard let jsonData = try? JSONEncoder().encode(errObj) else {
      return DetailedJsonError(withErrorCode: code, andErrorJson: "failed to marshal: \(message)")
    }
    guard let json = String(data: jsonData, encoding: .utf8) else {
      return DetailedJsonError(withErrorCode: code, andErrorJson: "failed to marshal: \(message)")
    }
    return DetailedJsonError(withErrorCode: code, andErrorJson: json)
  }

  /// Create a new DetailedJsonError from a NSError object.
  /// It will look for the JSON details from the userInfo.
  /// If no details found, it will use the localizedDescription as the message.
  public static func from(error: Error, withErrorCode errCode: String? = nil) -> DetailedJsonError {
    let nserr = error as NSError
    let code = errCode ?? nserr.userInfo[DetailedJsonErrorKeys.Code] as? String ?? PlaterrorsInternalError
    guard let json = nserr.userInfo[DetailedJsonErrorKeys.ErrorJson] as? String else {
      return DetailedJsonError.from(errorCode: code, andMessage: error.localizedDescription)
    }
    return DetailedJsonError(withErrorCode: code, andErrorJson: json)
  }

  /// A string code representing the type of error, which can be used to determine the error category.
  ///
  /// It is different than NSError's errorCode.
  public var errorCodeString: String {
    return self.code
  }

  /// A JSON string containing detailed information about the error (for example, the causes).
  ///
  /// This JSON string can be parsed by TypeScript's PlatformError.
  /// TypeScript's PlatformError is able to parse non-json strings as well.
  public var errorJson: String {
    return self.json
  }

  /// Returns an NSError from this error.
  /// This function should be mainly used by Objective-C.
  public func asNSError() -> NSError {
    // Ideally, the error code would be determined by the category;
    // but for simplicity's sake, we're using a single code for all errors.
    return NSError(domain: "org.outline.client.DetailedJsonError", code: 1, userInfo: [
      NSLocalizedDescriptionKey: self.errorCodeString,
      DetailedJsonErrorKeys.Code: self.errorCodeString,
      DetailedJsonErrorKeys.ErrorJson: self.errorJson,
    ])
  }
}
