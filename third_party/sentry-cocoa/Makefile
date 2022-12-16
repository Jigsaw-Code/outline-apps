
BUILD_DIR := ../../build/third_party/sentry-cocoa

.PHONY: default
default: $(BUILD_DIR)/Carthage/Build

.PHONY: update
update: clean $(BUILD_DIR)/Cartfile
	cd $(BUILD_DIR) && carthage update --use-xcframeworks --platform macOS,iOS
	cp -f $(BUILD_DIR)/Cartfile.resolved $(CURDIR)/Cartfile.resolved

$(BUILD_DIR)/Carthage/Build: $(BUILD_DIR)/Cartfile.resolved
	cd $(BUILD_DIR) && carthage bootstrap --use-xcframeworks --platform macOS,iOS

$(BUILD_DIR)/Cartfile.resolved: $(BUILD_DIR) $(CURDIR)/Cartfile.resolved
	cp $(CURDIR)/Cartfile.resolved $@

$(BUILD_DIR)/Cartfile: $(BUILD_DIR) $(CURDIR)/Cartfile
	cp $(CURDIR)/Cartfile $@

$(BUILD_DIR):
	mkdir -p $@

.PHONY: clean
clean:
	rm -rf $(BUILD_DIR)
