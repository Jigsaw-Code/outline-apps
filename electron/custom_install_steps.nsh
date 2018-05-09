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

!include x64.nsh

!macro customInstall
  MessageBox MB_OK "Your computer may ask you to trust a piece of software by OpenVPN. Outline uses this to protect all of the network traffic on your computer. Please answer yes when prompted."

  File /r "${PROJECT_DIR}\tap-windows6"
  File "${PROJECT_DIR}\electron\add_tap_device.bat"

  ${If} ${RunningX64}
    ; nsExec::Exec hides the command prompt window.
    nsExec::Exec 'add_tap_device.bat amd64'
  ${Else}
    nsExec::Exec 'add_tap_device.bat i386'
  ${EndIf}

  Pop $0
  StrCmp $0 0 noabort
  MessageBox MB_OK "Sorry, we could not configure your system to connect to Outline. Please try running the installer again. If you still cannot install Outline, please get in touch with us."
  ; TODO: Abort gracefully, i.e. uninstall, before exiting.
  Quit

  noabort:
!macroend

; TODO: Remove the TAP device on uninstall. This is impossible to implement safely
;       with the bundled tapinstall.exe because it can only remove *all* devices
;       having hwid tap0901 and these may include non-Outline devices.
