:: Copyright 2018 The Outline Authors
::
:: Licensed under the Apache License, Version 2.0 (the "License");
:: you may not use this file except in compliance with the License.
:: You may obtain a copy of the License at
::
::      http://www.apache.org/licenses/LICENSE-2.0
::
:: Unless required by applicable law or agreed to in writing, software
:: distributed under the License is distributed on an "AS IS" BASIS,
:: WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
:: See the License for the specific language governing permissions and
:: limitations under the License.

@echo off
setlocal EnableDelayedExpansion

set PWD=%~dp0%

:: Check whether the service is already installed, if so remove it in case there has been an update.
sc query OutlineService
if !errorlevel! equ 0 (
  echo "OutlineService already installed, uninstalling"
  net stop OutlineService
  sc delete OutlineService
  if !errorlevel! neq 0 (
    echo "Failed to uninstall OutlineService"
    exit /b 1
  )
)

:: Install the Outline Service and set it to run automatically on boot.
:: NOTE: the spaces after the arguments are necessary for a correct installation, do not remove!
sc create OutlineService binpath= "%PWD%OutlineService.exe" displayname= "OutlineService" start= "auto"
if !errorlevel! neq 0 (
  echo "Failed to install OutlineService"
  exit /b 1
)

:: Start the service to avoid requesting admin permissions in the app.
net start OutlineService
