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

import Tun2socks

/// Defines keys used in the userInfo of a NSError.
private enum DetailedJsonErrorKeys {
  static let Code: String = "DetailedJsonErrorCode"
  static let ErrorJson: String  = "DetailedJsonErrorDetails"
}

/// An error type representing an error with a code and a JSON string containing detailed information.
public enum DetailedJsonError: Error, CustomNSError {
  case withCategory(_ category: String, andJsonDetail: String)
  case fromPlatformError(_ perr: PlaterrorsPlatformError)
  case fromNSError(_ nserr: NSError)

  /// A string code representing the type of error, which can be used to determine the error category.
  ///
  /// It is different than NSError's errorCode.
  public var category: String {
    switch self {
    case .withCategory(let category, _):
      return category
    case .fromPlatformError(let perr):
      return perr.code
    case .fromNSError(let nserr):
      return nserr.userInfo[DetailedJsonErrorKeys.Code] as? String ?? PlaterrorsInternalError;
    }
  }

  /// A JSON string containing detailed information about the error (for example, the causes).
  ///
  /// This JSON string can be parsed by TypeScript's PlatformError.
  /// TypeScript's PlatformError is able to parse non-json strings as well.
  public var errorJson: String {
    switch self {
    case .withCategory(_, let json):
      return json
    case .fromPlatformError(let perr):
      return DetailedJsonError.marshalJsonFrom(platformError: perr)
    case .fromNSError(let nserr):
      return DetailedJsonError.marshalJsonFrom(nsError: nserr)
    }
  }

  private static func marshalJsonFrom(platformError perr: PlaterrorsPlatformError) -> String {
    var marshalErr: NSError?
    var errorJson = PlaterrorsMarshalJSONString(perr, &marshalErr)
    if marshalErr != nil {
      errorJson = "error code = \(perr.code), failed to fetch details"
    }
    return errorJson
  }

  private static func marshalJsonFrom(nsError nserr: NSError) -> String {
    return nserr.userInfo[DetailedJsonErrorKeys.ErrorJson] as? String ?? nserr.localizedDescription
  }

  // MARK: - CustomNSError implementations

  public static var errorDomain: String {
    return "org.outline.client.DetailedJsonError"
  }

  /// Returns an integer error code used by NSError
  ///
  /// Ideally, the error code would be determined by the category;
  /// but for simplicity's sake, we're using a single code for all errors.
  public var errorCode: Int {
    return 1
  }

  public var errorUserInfo: [String : Any] {
    var userInfo: [String : Any] = switch self {
      case .fromNSError(let nserr): nserr.userInfo
      default: [:]
    }
    userInfo[DetailedJsonErrorKeys.Code] = self.category
    userInfo[DetailedJsonErrorKeys.ErrorJson] = self.errorJson
    return userInfo
  }
}
