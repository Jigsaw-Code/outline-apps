BUILDDIR=$(CURDIR)/output/build
GOBIN=$(CURDIR)/output/bin

GOMOBILE=$(GOBIN)/gomobile
# Add GOBIN to $PATH so `gomobile` can find `gobind`.
GOBIND=env PATH="$(GOBIN):$(PATH)" "$(GOMOBILE)" bind
IMPORT_HOST=github.com
IMPORT_PATH=$(IMPORT_HOST)/Jigsaw-Code/outline-client

.PHONY: android apple linux windows

all: android apple linux windows

ROOT_PKG=src/tun2socks
# Don't strip Android debug symbols so we can upload them to crash reporting tools.
ANDROID_BUILD_CMD=$(GOBIND) -a -ldflags '-w' -target=android -androidapi 19 -tags android -work

android: $(BUILDDIR)/android/tun2socks.aar

$(BUILDDIR)/android/tun2socks.aar: $(GOMOBILE)
	mkdir -p "$(BUILDDIR)/android"
	$(ANDROID_BUILD_CMD) -o "$@" $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

$(BUILDDIR)/ios/Tun2socks.xcframework: $(GOMOBILE)
  # -iosversion should match what outline-client supports.
	$(GOBIND) -iosversion=12.0 -target=ios,iossimulator -o $@ -ldflags '-w' -bundleid org.outline.tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

$(BUILDDIR)/macos/Tun2socks.xcframework: $(GOMOBILE)
  # MACOSX_DEPLOYMENT_TARGET and -iosversion should match what outline-client supports.
	export MACOSX_DEPLOYMENT_TARGET=10.14; $(GOBIND) -iosversion=13.1 -target=macos,maccatalyst -o $@ -ldflags '-w' -bundleid org.outline.tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/tun2socks $(IMPORT_PATH)/$(ROOT_PKG)/outline/shadowsocks

apple: $(BUILDDIR)/apple/Tun2socks.xcframework

$(BUILDDIR)/apple/Tun2socks.xcframework: $(BUILDDIR)/ios/Tun2socks.xcframework $(BUILDDIR)/macos/Tun2socks.xcframework
	find $^ -name "Tun2socks.framework" -type d | xargs -I {} echo " -framework {} " | \
		xargs xcrun xcodebuild -create-xcframework -output "$@"

XGO=$(GOBIN)/xgo
TUN2SOCKS_VERSION=v1.16.11
XGO_LDFLAGS='-w -X main.version=$(TUN2SOCKS_VERSION)'
ELECTRON_PKG=$(ROOT_PKG)/outline/electron

# TODO: build directly when on linux
LINUX_BUILDDIR=$(BUILDDIR)/linux

linux: $(LINUX_BUILDDIR)/tun2socks

$(LINUX_BUILDDIR)/tun2socks: $(XGO)
	mkdir -p "$(LINUX_BUILDDIR)/$(IMPORT_PATH)"
	$(XGO) -ldflags $(XGO_LDFLAGS) --targets=linux/amd64 -dest "$(LINUX_BUILDDIR)" -pkg $(ELECTRON_PKG) .
	mv "$(LINUX_BUILDDIR)/$(IMPORT_PATH)-linux-amd64" "$@"
	rm -r "$(LINUX_BUILDDIR)/$(IMPORT_HOST)"

# TODO: build directly when on windows
WINDOWS_BUILDDIR=$(BUILDDIR)/windows

windows: $(WINDOWS_BUILDDIR)/tun2socks.exe

$(WINDOWS_BUILDDIR)/tun2socks.exe: $(XGO)
	mkdir -p "$(WINDOWS_BUILDDIR)/$(IMPORT_PATH)"
	$(XGO) -ldflags $(XGO_LDFLAGS) --targets=windows/386 -dest "$(WINDOWS_BUILDDIR)" -pkg $(ELECTRON_PKG) .
	mv "$(WINDOWS_BUILDDIR)/$(IMPORT_PATH)-windows-386.exe" "$@"
	rm -r "$(WINDOWS_BUILDDIR)/$(IMPORT_HOST)"


$(GOMOBILE): go.mod
	env GOBIN="$(GOBIN)" go install golang.org/x/mobile/cmd/gomobile
	env GOBIN="$(GOBIN)" $(GOMOBILE) init

$(XGO): go.mod
	env GOBIN="$(GOBIN)" go install github.com/crazy-max/xgo

go.mod: tools.go
	go mod tidy
	touch go.mod
