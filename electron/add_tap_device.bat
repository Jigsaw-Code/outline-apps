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

:: Add the device, recording the names of devices before and after to help
:: us find the name of the new device:
::  - While we could limit the search to devices having ServiceName=tap0901,
::    that will cause wmic to output just "no instances available" when there
::    are no other TAP devices present, messing up the diff.
::  - Pipe wmic output through find to suppress blank lines, which also mess up
::    the diff.
set BEFORE_DEVICES=%tmp%\outlineinstaller-tap-devices-before.txt
set AFTER_DEVICES=%tmp%\outlineinstaller-tap-devices-after.txt
set DEVICE_DIFF=%tmp%\outlineinstaller-new-tap-device.txt
wmic nic get netconnectionid /format:list | findstr "=" > %BEFORE_DEVICES%
tap-windows6\%1\tapinstall install tap-windows6\%1\OemVista.inf tap0901
if %errorlevel% neq 0 (
  echo Could not create TAP device.
  exit /b 1
)
wmic nic get netconnectionid /format:list | findstr "=" > %AFTER_DEVICES%

:: Find the name of the new device:
::  - Use a temp file to save/load the result to avoid escaping issues.
::  - Pipe input from /dev/null to prevent Powershell hanging, waiting for EOF.
powershell "(compare-object (cat %BEFORE_DEVICES%) (cat %AFTER_DEVICES%) | format-wide InputObject | out-string).split(\"=\")[1].trim()" > %DEVICE_DIFF% < NUL
set /p NEW_DEVICE= < %DEVICE_DIFF%
echo New TAP device name: %NEW_DEVICE%

:: Rename the device.
netsh interface set interface name = "%NEW_DEVICE%" newname = "%DEVICE_NAME%" >nul
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

:: Windows has no system-wide DNS server; each network device can have its
:: "own" set of DNS servers. Windows seems to use the DNS server(s) of the
:: network device associated with the default gateway. This is good for us
:: as it means we do not have to modify the DNS settings of any other network
:: device in the system. Configure with OpenDNS and Dyn resolvers.
netsh interface ip set dnsservers %DEVICE_NAME% static address=208.67.222.222 >nul
if %errorlevel% neq 0 (
  echo Could not configure TAP device DNS.
  exit /b 1
)
netsh interface ip add dnsservers %DEVICE_NAME% 216.146.35.35 index=2 >nul
if %errorlevel% neq 0 (
  echo Could not configure TAP device  secondary DNS.
  exit /b 1
)
