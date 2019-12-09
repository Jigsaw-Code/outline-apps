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
setlocal

set DEVICE_NAME=outline-tap0
set DEVICE_HWID=tap0901

:: Because we've seen multiple failures due to commands (netsh, etc.) not being
:: found, append some common directories to the PATH.
::
:: Note:
::  - %SystemRoot% almost always expands to c:\windows.
::  - Do *not* surround with quotes.
set PATH=%PATH%;%SystemRoot%\system32;%SystemRoot%\system32\wbem;%SystemRoot%\system32\WindowsPowerShell/v1.0

:: Check whether the device already exists.
netsh interface show interface name=%DEVICE_NAME% >nul
if %errorlevel% equ 0 (
  echo TAP network device already exists.
  goto :configure
)

echo Creating TAP network device...
tap-windows6\tapinstall install tap-windows6\OemVista.inf %DEVICE_HWID%
if %errorlevel% neq 0 (
  echo Could not create TAP network device. >&2
  exit /b 1
)

:: Find the name of the most recently installed TAP device in the registry and rename it.
echo Searching for new TAP network device name...
set TAP_NAME_FILE=%tmp%\outlineinstaller-tap-device-name.txt
find_tap_name.exe --component-id %DEVICE_HWID% > %TAP_NAME_FILE%
if %errorlevel% neq 0 (
  echo Could not find TAP device name. >&2
  exit /b 1
)
set /p TAP_NAME=<%TAP_NAME_FILE%
echo Found TAP device name: %TAP_NAME%
netsh interface set interface name= "%TAP_NAME%" newname= "%DEVICE_NAME%"
if %errorlevel% neq 0 (
  echo Could rename TAP device. >&2
  exit /b 1
)

:: We've occasionally seen delays before netsh will "see" the new device, at least for
:: purposes of configuring IP and DNS ("netsh interface show interface name=xxx" does not
:: seem to be affected).
echo Testing that the new TAP network device is visible to netsh...
netsh interface ip show interfaces | find "%DEVICE_NAME%" >nul
if %errorlevel% equ 0 goto :configure

:loop
echo waiting...
:: timeout doesn't like the environment created by nsExec::ExecToStack and exits with:
:: "ERROR: Input redirection is not supported, exiting the process immediately."
waitfor /t 10 thisisnotarealsignalname >nul 2>&1
netsh interface ip show interfaces | find "%DEVICE_NAME%" >nul
if %errorlevel% neq 0 goto :loop

:configure

:: Try to enable the device, in case it's somehow been disabled.
::
:: Annoyingly, this returns an error and outputs a confusing message if the device exists and is
:: already enabled:
::   This network connection does not exist.
::
:: So, continue even if this command fails - and always include its output.
echo (Re-)enabling TAP network device...
netsh interface set interface "%DEVICE_NAME%" admin=enabled

:: Give the device an IP address.
:: 10.0.85.x is a guess which we hope will work for most users (Docker for
:: Windows uses 10.0.75.x by default): if the address is already in use the
:: script will fail and the installer will show an error message to the user.
:: TODO: Actually search the system for an unused subnet or make the subnet
::       configurable in the Outline client.
echo Configuring TAP device subnet...
netsh interface ip set address %DEVICE_NAME% static 10.0.85.2 255.255.255.0
if %errorlevel% neq 0 (
  echo Could not set TAP network device subnet. >&2
  exit /b 1
)

:: Windows has no system-wide DNS server; each network device can have its
:: "own" set of DNS servers. Windows seems to use the DNS server(s) of the
:: network device associated with the default gateway. This is good for us
:: as it means we do not have to modify the DNS settings of any other network
:: device in the system. Configure with OpenDNS and Dyn resolvers.
echo Configuring primary DNS...
netsh interface ip set dnsservers %DEVICE_NAME% static address=208.67.222.222
if %errorlevel% neq 0 (
  echo Could not configure TAP device primary DNS. >&2
  exit /b 1
)
echo Configuring secondary DNS...
netsh interface ip add dnsservers %DEVICE_NAME% 216.146.35.35 index=2
if %errorlevel% neq 0 (
  echo Could not configure TAP device secondary DNS. >&2
  exit /b 1
)
echo TAP network device added and configured successfully
