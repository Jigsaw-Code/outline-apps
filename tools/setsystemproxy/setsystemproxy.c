// Copyright 2018 The Outline Authors
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

#include <stdio.h>
#include <stdlib.h>
#include <windef.h>
#include <winbase.h>
#include <wininet.h>

void usage(const char* path) {
  printf("usage: %s [on <proxy host:port> | off]\n", path);
  exit(1);
}

int main(int argc, char* argv[]) {
  if (argc < 2) {
    usage(argv[0]);
  }

  // https://msdn.microsoft.com/en-us/library/windows/desktop/aa385146(v=vs.85).aspx
  INTERNET_PER_CONN_OPTION_LIST options;

  options.dwOptionCount = 3;
  options.pOptions =
      (INTERNET_PER_CONN_OPTION*)calloc(options.dwOptionCount, sizeof(INTERNET_PER_CONN_OPTION));

  // The remaining fields are ignored if this is set to PROXY_TYPE_DIRECT.
  options.pOptions[0].dwOption = INTERNET_PER_CONN_FLAGS;

  options.pOptions[1].dwOption = INTERNET_PER_CONN_PROXY_SERVER;

  options.pOptions[2].dwOption = INTERNET_PER_CONN_PROXY_BYPASS;
  options.pOptions[2].Value.pszValue = TEXT("<local>");

  // Default connection.
  // Must be specified, or the program segfaults.
  options.pszConnection = NULL;

  if (strcmp(argv[1], "on") == 0) {
    if (argc != 3) {
      usage(argv[0]);
    }

    options.pOptions[0].Value.dwValue = PROXY_TYPE_PROXY | PROXY_TYPE_DIRECT;
    options.pOptions[1].Value.pszValue = argv[2];
  } else if (strcmp(argv[1], "off") == 0) {
    options.pOptions[0].Value.dwValue = PROXY_TYPE_DIRECT;
  } else {
    usage(argv[0]);
  }

  // https://msdn.microsoft.com/en-us/library/windows/desktop/aa385114(v=vs.85).aspx
  int result = InternetSetOption(NULL, INTERNET_OPTION_PER_CONNECTION_OPTION, &options,
                                 sizeof(INTERNET_PER_CONN_OPTION_LIST));

  exit(result == FALSE);
}
