## Electron Development Instructions

Unlike the Android and Apple clients, the Windows and Linux clients use the Electron framework, rather than Cordova.

To build the Electron clients, run (it will also package an installer executable into `build/dist`):

```sh
npm run action electron/build [windows|linux]
```

To run the Electron clients, run:

```sh
npm run action electron/start [windows|linux]
```

### Windows

Requirements for building on Windows:

- [Cygwin](https://cygwin.com/install.html), if running action scripts outside of `src`. It provides the "missing Unix pieces" required by build system such as rsync (and many others). Besides the default selected Unix tools such as `bash` and `rsync`, please also make sure to install `git` during Cygwin installation as well. You will need to clone this repository using `git` in Cygwin instead of the native Windows version of git, in order to ensure Unix line endings.

To build the _release_ version of Windows installer, you'll also need:

- [Java 8+ Runtime](https://www.java.com/en/download/). This is required for the cross-platform Windows executable signing tool [Jsign](https://ebourg.github.io/jsign/). If you don't need to sign the executables, feel free to skip this.
