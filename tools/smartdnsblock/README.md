# `smartdnsblock`

`smartdnsblock.exe` is a Windows only utility application.

## How to Build

We recommend to use [Visual Studio 2019+](https://visualstudio.microsoft.com/downloads/) for building. But if it is not applicable to do so (for example, when in a CI server), feel free to download the [standalone build tools](https://visualstudio.microsoft.com/downloads/?q=build+tools#build-tools-for-visual-studio-2022) without Visual Studio.

The simplest way to build this application is by double clicking `tools/smartdnsblock/smartdnsblock.sln` which will open the Visual Studio GUI, and then:

* Note that there are two dropdown buttons in the toolbar area:
   - For "Solution Configurations" dropdown, choose "Release"
   - For "Solution Platforms" dropdown , choose "x86"
* Use menu item "Build → Build Solution" to build the project
* `smartdnsblock.exe` will be generated in `tools/smartdnsblock/bin` folder

You can also build it through command line tools without launching Visual Studio:

* Launch "Developer PowerShell for VS 2019" from Start Menu
* `cd <working-dir>/tools/smartdnsblock`
* `msbuild smartdnsblock.sln /p:Configuration=Release /p:Platform=x86`
* `smartdnsblock.exe` will be generated in `tools/smartdnsblock/bin` folder
