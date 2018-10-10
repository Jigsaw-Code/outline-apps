; Copyright 2018 The Outline Authors
;
; Licensed under the Apache License, Version 2.0 (the "License");
; you may not use this file except in compliance with the License.
; You may obtain a copy of the License at
;
;      http://www.apache.org/licenses/LICENSE-2.0
;
; Unless required by applicable law or agreed to in writing, software
; distributed under the License is distributed on an "AS IS" BASIS,
; WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
; See the License for the specific language governing permissions and
; limitations under the License.

!include StrFunc.nsh
!include WinVer.nsh
!include x64.nsh

!include env.nsh

; StrFunc weirdness; this fix suggested here:
; https://github.com/electron-userland/electron-builder/issues/888
!ifndef BUILD_UNINSTALLER
${StrNSISToIO}
${StrRep}
!endif

!macro customInstall
  ; Normally, because we mark the installer binary as requiring administrator permissions, the
  ; installer will be running with administrator permissions at this point. The exception is when
  ; the system is running with the *lowest* (least safe) UAC setting in which case the installer
  ; can progress to this point without administrator permissions.
  ;
  ; If that's the case, exit now so we don't waste time to trying to install the TAP device, etc.
  ; Additionally, the client can detect their absence and prompt the user to reinstall.
  ;
  ; The returned value does *not* seem to be based on the user's current diaplay language.
  UserInfo::GetAccountType
  Pop $0
  StrCmp $0 "Admin" isadmin
  MessageBox MB_OK "Sorry, Outline requires administrator permissions."
  Quit

  isadmin:

  ; TAP device files.
  File /r "${PROJECT_DIR}\tap-windows6"
  File "${PROJECT_DIR}\electron\add_tap_device.bat"

  ; OutlineService files, stopping the service first in case it's still running.
  nsExec::Exec "net stop OutlineService"
  File "${PROJECT_DIR}\OutlineService.exe"
  File "${PROJECT_DIR}\Newtonsoft.Json.dll"
  File "${PROJECT_DIR}\electron\install_windows_service.bat"

  ; ExecToStack captures both stdout and stderr from the script, in the order output.
  ${If} ${RunningX64}
    nsExec::ExecToStack 'add_tap_device.bat amd64'
  ${Else}
    nsExec::ExecToStack 'add_tap_device.bat i386'
  ${EndIf}

  Pop $0
  Pop $1
  StrCmp $0 0 installservice
  MessageBox MB_OK "Sorry, we could not configure your system to connect to Outline. Please try \
    running the installer again. If you still cannot install Outline, please get in \
    touch with us and let us know that the TAP device could not be installed."

  ; Submit a Sentry error event.
  ;
  ; This will get bundled into an issue named "could not install TAP device" with the following
  ; attributes:
  ;  - a single breadcrumb containing the output of add_tap_device.bat
  ;  - Windows version, as a tag named "os" with a value identical in most cases to what the
  ;    JavaScript Sentry client produces, e.g. "Windows 10.0.17134"
  ;  - client version
  ;
  ; Note:
  ;  - Sentry won't accept a breadcrumbs without a timestamp; fortunately, it accepts obviously
  ;    bogus values so we don't have to fetch the real time.
  ;  - Because nsExec::ExecToStack yields "NSIS strings" strings suitable for inclusion in, for
  ;    example, a MessageBox, e.g. "device not found$\ncommand failed", we must convert it to a
  ;    string that Sentry will like *and* can fit on one line, e.g.
  ;    "device not found\ncommand failed"; fortunately, StrFunc.nsh's StrNSISToIO does precisely
  ;    this.
  ;  - RELEASE and SENTRY_DSN are defined in env.nsh which is generated at build time by
  ;    {package,release}_action.sh.

  ; http://nsis.sourceforge.net/Docs/StrFunc/StrFunc.txt
  Var /GLOBAL FAILURE_MESSAGE
  ${StrNSISToIO} $FAILURE_MESSAGE $1
  ${StrRep} $FAILURE_MESSAGE $FAILURE_MESSAGE '"' '\"'

  ${WinVerGetMajor} $R0
  ${WinVerGetMinor} $R1
  ${WinVerGetBuild} $R2

  ; http://nsis.sourceforge.net/Inetc_plug-in#post
  inetc::post '{\
    "message":"could not install TAP device",\
    "release":"${RELEASE}",\
    "tags":[\
      ["os", "Windows $R0.$R1.$R2"]\
    ],\
    "breadcrumbs":[\
      {"timestamp":1, "message":"$FAILURE_MESSAGE"}\
    ]\
  }' /TOSTACK ${SENTRY_DSN} /END

  Quit

  installservice:

  nsExec::Exec install_windows_service.bat

  nsExec::Exec "sc query OutlineService"
  Pop $0
  StrCmp $0 0 success
  ; TODO: Trigger a Sentry report for service installation failure, too, and revisit
  ;       the restart stuff in the TypeScript code.
  MessageBox MB_OK "Sorry, we could not configure your system to connect to Outline. Please try \
    running the installer again. If you still cannot install Outline, please get in touch with us \
    and let us know that OutlineService failed to install."
  Quit

  success:

!macroend

; TODO: Remove the TAP device on uninstall. This is impossible to implement safely
;       with the bundled tapinstall.exe because it can only remove *all* devices
;       having hwid tap0901 and these may include non-Outline devices.
!macro customUnInstall
  nsExec::Exec "net stop OutlineService"
  nsExec::Exec "sc delete OutlineService"
!macroend
