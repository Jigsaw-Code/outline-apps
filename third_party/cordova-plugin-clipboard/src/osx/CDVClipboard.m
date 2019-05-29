#import <Foundation/Foundation.h>
#import <Cordova/CDVPlugin.h>
#import <Cordova/CDVPluginResult.h>
#import "CDVClipboard.h"

@implementation CDVClipboard

- (void)copy:(CDVInvokedUrlCommand*)command {
	[self.commandDelegate runInBackground:^{
		NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
		NSString *text = [command.arguments objectAtIndex:0];

		[pasteboard clearContents];
		[pasteboard setString:text forType:NSStringPboardType];

		CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:text];
		[self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
	}];
}

- (void)paste:(CDVInvokedUrlCommand*)command {
	[self.commandDelegate runInBackground:^{
		NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
		NSString *text = [pasteboard stringForType:NSPasteboardTypeString];
		if (text == nil) {
			text = @"";
		}

		CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:text];
		[self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
	}];
}

@end
