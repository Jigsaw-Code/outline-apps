
.PHONY: clean

Carthage/Build: Cartfile
	carthage build --use-xcframeworks --no-use-binaries --platform macOS,iOS

clean:
	rm -rf Carthage
