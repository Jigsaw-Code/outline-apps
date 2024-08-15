// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#import "AppDelegate.h"
#import "Outline-Swift.h"

@import ServiceManagement;
@import OutlineNotification;
@import CocoaLumberjack;

#ifdef DEBUG
const DDLogLevel ddLogLevel = DDLogLevelDebug;
#else
const DDLogLevel ddLogLevel = DDLogLevelInfo;
#endif

@interface AppDelegate()
@property (strong, nonatomic) NSStatusItem *statusItem;
@property (strong, nonatomic) NSPopover *popover;
@property bool isSystemShuttingDown;
@end

@implementation AppDelegate

@synthesize window;

- (id)init {
  self = [super init];
  return self;
}

#pragma mark - Lifecycle

- (void)applicationDidStartLaunching:(NSNotification*)aNotification {
}

- (void)applicationWillFinishLaunching:(NSNotification *)aNotification {
  [[NSAppleEventManager sharedAppleEventManager]
      setEventHandler:self
          andSelector:@selector(handleURLEvent:withReplyEvent:)
        forEventClass:kInternetEventClass
           andEventID:kAEGetURL];
  // Don't ever show the default Cordova window, as we will display its content view in a popover.
  [self.window close];

  [NSWorkspace.sharedWorkspace.notificationCenter
      addObserverForName:NSWorkspaceWillPowerOffNotification
                  object:nil
                   queue:nil
              usingBlock:^(NSNotification *_Nonnull n) {
                self.isSystemShuttingDown = YES;
              }];
  [NSNotificationCenter.defaultCenter addObserverForName:NSNotification.kVpnConnected
                                                  object:nil
                                                   queue:[NSOperationQueue mainQueue]
                                              usingBlock:^(NSNotification * _Nonnull note) {
                                                [self setAppIcon:@"StatusBarButtonImageConnected"];
  }];
  [NSNotificationCenter.defaultCenter addObserverForName:NSNotification.kVpnDisconnected
                                                  object:nil
                                                   queue:[NSOperationQueue mainQueue]
                                              usingBlock:^(NSNotification * _Nonnull note) {
                                                [self setAppIcon:@"StatusBarButtonImage"];
                                              }];
}

- (void)handleURLEvent:(NSAppleEventDescriptor*)event
        withReplyEvent:(NSAppleEventDescriptor*)replyEvent {
  NSString *url = [[event paramDescriptorForKeyword:keyDirectObject] stringValue];
  [[NSNotificationCenter defaultCenter]
      postNotificationName:NSNotification.kHandleUrl object:url];
  if (!self.popover.isShown) {
    [self showPopover];
  }
}

- (void)applicationDidFinishLaunching:(NSNotification*)aNotification {
  self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
  self.statusItem.button.action = @selector(togglePopover);
  [self setAppIcon:@"StatusBarButtonImage"];
  self.popover = [[NSPopover alloc] init];
  self.popover.behavior = NSPopoverBehaviorTransient;
  self.popover.contentViewController = [[NSViewController alloc] initWithNibName:@"MainViewController"
                                                                          bundle:[NSBundle mainBundle]];
  self.popover.contentViewController.view = self.window.contentView;

  // The rendering of the popover is relative to the app's status item in the status bar.
  // Even though we've already created the status bar above, the popover is being created
  // before the status item has been rendered in the UI. This causes the initial popover
  // load to be "floating" and ends up aligned at the bottom of the screen. For this initial
  // load we add a small artificial delay to prevent that from happening.
  double delayInSeconds = 0.5;
  dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, delayInSeconds * NSEC_PER_SEC);
  dispatch_after(popTime, dispatch_get_main_queue(), ^(void){
    [self showPopover];
  });
}

- (void)applicationWillTerminate:(NSNotification *)notification {
  if (!self.isSystemShuttingDown) {
    // Don't post a quit notification if the system is shutting down so the VPN is not stopped
    // and it auto-connects on startup.
    [[NSNotificationCenter defaultCenter] postNotificationName:NSNotification.kAppQuit
                                                        object:nil];
  }
}

#pragma mark - Popover

- (void)togglePopover {
  if (self.popover.isShown) {
    [self closePopover];
  } else {
    [self showPopover];
  }
}

- (void)closePopover {
  [self.popover close];
}

- (void)showPopover {
  [self.popover showRelativeToRect:self.statusItem.button.bounds
                            ofView:self.statusItem.button
                     preferredEdge:NSRectEdgeMinY];
  // Activate the application in order to focus the popover.
  [[NSRunningApplication currentApplication]
      activateWithOptions:NSApplicationActivateIgnoringOtherApps];
}

- (void)setAppIcon:(NSString *)imageName {
  self.statusItem.button.image = [NSImage imageNamed:imageName];
  self.statusItem.button.image.template = YES;
}

@end
