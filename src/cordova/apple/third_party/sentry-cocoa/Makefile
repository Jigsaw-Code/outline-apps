
.PHONY: clean

Carthage/Build: Cartfile
	carthage update --use-xcframeworks --no-use-binaries --platform macOS,iOS

clean:
	rm -rf Carthage
