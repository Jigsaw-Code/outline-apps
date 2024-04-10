BUILDDIR=$(CURDIR)/client/output/build
GOBIN=$(CURDIR)/client/output/bin

GOMOBILE=$(GOBIN)/gomobile
# Add GOBIN to $PATH so `gomobile` can find `gobind`.
GOBIND=env PATH="$(GOBIN):$(PATH)" "$(GOMOBILE)" bind
IMPORT_HOST=github.com
IMPORT_PATH=$(IMPORT_HOST)/Jigsaw-Code/outline-apps

.PHONY: android apple linux windows browser

all: android apple linux windows

ROOT_PKG=client/src/tun2socks

android: $(BUILDDIR)/android/tun2socks.aar

$(BUILDDIR)/android/tun2socks.aar: $(GOMOBILE)
	mkdir -p "$(BUILDDIR)/android"
  # Don't strip Android debug symbols so we can upload them to crash reporting tools.
	$(GOBIND) -target=android -androidapi 19 -tags android -work -a -ldflags '-w' -o "$@" $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

$(BUILDDIR)/ios/Tun2socks.xcframework: $(GOMOBILE)
  # -iosversion should match what outline-client supports.
	$(GOBIND) -target=ios,iossimulator -iosversion=12.0 -bundleid org.outline.tun2socks -ldflags '-w' -o "$@" $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

$(BUILDDIR)/macos/Tun2socks.xcframework: $(GOMOBILE)
  # MACOSX_DEPLOYMENT_TARGET and -iosversion should match what outline-client supports.
	export MACOSX_DEPLOYMENT_TARGET=10.14; $(GOBIND) -iosversion=13.1 -target=macos,maccatalyst -o $@ -ldflags '-w' -bundleid org.outline.tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

apple: $(BUILDDIR)/apple/Tun2socks.xcframework

$(BUILDDIR)/apple/Tun2socks.xcframework: $(BUILDDIR)/ios/Tun2socks.xcframework $(BUILDDIR)/macos/Tun2socks.xcframework
	find $^ -name "Tun2socks.framework" -type d | xargs -I {} echo " -framework {} " | \
		xargs xcrun xcodebuild -create-xcframework -output "$@"

TUN2SOCKS_VERSION=v1.16.11
# -w disable DWARF generation
LDFLAGS='-static -w -X main.version=$(TUN2SOCKS_VERSION)'
ELECTRON_PKG="./client/src/tun2socks/outline/electron"

# TODO: build directly when on linux
LINUX_BUILDDIR=$(BUILDDIR)/linux

linux: $(LINUX_BUILDDIR)/tun2socks

$(LINUX_BUILDDIR)/tun2socks:
	mkdir -p "$(@D)"
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 CC='zig cc -target x86_64-linux' go build --trimpath --ldflags=--extldflags=$(LDFLAGS) -o "$@" $(ELECTRON_PKG)

# TODO: build directly when on windows
WINDOWS_BUILDDIR=$(BUILDDIR)/windows

windows: $(WINDOWS_BUILDDIR)/tun2socks.exe

$(WINDOWS_BUILDDIR)/tun2socks.exe:
	mkdir -p "$(@D)"
	GOOS=windows GOARCH=amd64 CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc go build --trimpath --ldflags=--extldflags=$(LDFLAGS) -o "$@" $(ELECTRON_PKG)

$(GOMOBILE): go.mod
	mkdir -p "$(@D)"
	go build -o "$(@D)" golang.org/x/mobile/cmd/gomobile golang.org/x/mobile/cmd/gobind

go.mod: tools.go
	go mod tidy
	touch go.mod

browser:
	echo 'browser environment: nothing to do'
