
.PHONY: clean

Carthage/Build: Cartfile
	carthage bootstrap --use-xcframeworks --platform macOS,iOS

clean:
	rm -rf Carthage
