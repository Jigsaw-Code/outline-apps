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

To build the _release_ version of Windows installer, you'll also need:

- [Java 8+ Runtime](https://www.java.com/en/download/). This is required for the cross-platform Windows executable signing tool [Jsign](https://ebourg.github.io/jsign/). If you don't need to sign the executables, feel free to skip this.
