# Electron Development Instructions

Unlike the Android and Apple clients, the Windows and Linux clients use the Electron framework, rather than Cordova.

You will need [Docker](https://www.docker.com/) installed to build the Electron clients.

> If you can't use Docker, you can use [podman](https://podman.io) as substitute by running the following (for macOS):

```sh
podman machine init
sudo ln -s $(which podman) /usr/local/bin/docker
sudo /opt/homebrew/Cellar/podman/<podman version>/bin/podman-mac-helper install
podman machine start
```

> You may run into the error: `/var/folders/<path>/xgo-cache: no such file or directory`. If so, simply create that directory with `mkdir -p /var/folders/<path>/xgo-cache` and try again.

To build the Electron clients, run (it will also package an installer executable into `build/dist`):

```sh
npm run action electron/build [windows|linux]
```

To run the Electron clients, run:

```sh
npm run action electron/start [windows|linux]
```

## Windows

To build for Windows on a macOS or Linux, you need to first install [MinGW-w64](https://www.mingw-w64.org/) v11.0.1+.

With [MacPorts](https://www.mingw-w64.org/downloads/#macports) (official channel):

```sh
sudo port install x86_64-w64-mingw32-gcc @11.0.1
```

With Homebrew (unofficial, how to ensure consistent version?):

```sh
brew install mingw-w64
```

On Ubuntu:

```sh
apt update && apt install -y gcc-mingw-w64-x86-64
```

To build the _release_ version of Windows installer, you'll also need:

- [Java 8+ Runtime](https://www.java.com/en/download/). This is required for the cross-platform Windows executable signing tool [Jsign](https://ebourg.github.io/jsign/). If you don't need to sign the executables, feel free to skip this.

## Linux

To build for Linux on a macOS, you need to first install the [musl-cross compiler](https://github.com/GregorR/musl-cross).
You can do that with a [Homebrew formula](https://github.com/FiloSottile/homebrew-musl-cross):

```sh
brew install filosottile/musl-cross/musl-cross
```
