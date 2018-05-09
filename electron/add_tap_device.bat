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

:: Accepts one argument, the system's architecture (amd64 or i386).

@echo off

set DEVICE_NAME=outline-tap0

:: Check whether the device already exists.
netsh interface show interface name=%DEVICE_NAME% >nul
if %errorlevel% equ 0 (
  echo %DEVICE_NAME% already exists.
  exit /b
)

:: Add the device.
tap-windows6\amd64\tapinstall install tap-windows6\%1\OemVista.inf tap0901 >nul
if %errorlevel% neq 0 (
  echo Could not create TAP device.
  exit /b 1
)

:: Find the name of the new device.
:: If there are other tap-windows6 applications installed, there could
:: be several: assume the one we just created appears *last* in the list.
for /f "tokens=2 delims=:" %%i in ('tap-windows6\%1\tapinstall hwids tap0901 ^|find "Name:"') do set RESULT=%%i
:: Strip leading whitespace from the variable.
for /f "tokens=* delims= " %%a in ("%RESULT%") do set RESULT=%%a
echo New TAP device name: %RESULT%

:: Now we now the new device's name.
:: However, in order to use netsh on the new device, we needs its *ID*.
::
:: We can use some wmic magic; to see how this works, examine the output of:
::   wmic /output:c:\wmic.csv nic
::
:: Escaping gets comically complicated - some help can be found here:
::   https://stackoverflow.com/questions/15527071/wmic-command-not-working-in-for-loop-of-batch-file
for /f "tokens=2 delims==" %%i in ('wmic nic where "name=\"%RESULT%\"" get netconnectionID /format:list') do set ID=%%i
echo New TAP device ID: %ID%

:: Rename the device.
netsh interface set interface name = "%ID%" newname = "%DEVICE_NAME%" >nul
if %errorlevel% neq 0 (
  echo Could not rename TAP device.
  exit /b 1
)

:: Give the device an IP address.
:: 10.0.85.x is a guess which we hope will work for most users (Docker for
:: Windows uses 10.0.75.x by default): if the address is already in use the
:: script will fail and the installer will show an error message to the user.
:: TODO: Actually search the system for an unused subnet or make the subnet
::       configurable in the Outline client.
netsh interface ip set address %DEVICE_NAME% static 10.0.85.2 255.255.255.0 >nul

if %errorlevel% neq 0 (
  echo Could not set TAP device subnet.
  exit /b 1
)
