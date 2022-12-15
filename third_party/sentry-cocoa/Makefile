
.PHONY: clean

Carthage/Build: Cartfile
	carthage bootstrap --use-xcframeworks --no-use-binaries --platform macOS,iOS

clean:
	rm -rf Carthage
