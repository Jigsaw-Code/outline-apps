// Copyright 2023 The Outline Authors
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
#import "AppKitBridge-Bridging-Header.h"
#import "Outline-Swift.h"

#if TARGET_OS_MACCATALYST
@import ServiceManagement;
#endif

@interface AppDelegate (Outline) <UIApplicationDelegate>
@end

@implementation AppDelegate

@synthesize window;

- (id)init {
  self = [super init];
  return self;
}

#pragma mark - Lifecycle

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:
        (NSDictionary<UIApplicationLaunchOptionsKey, id> *)launchOptions {
#if TARGET_OS_MACCATALYST
  // Configure the Catalyst window.
  NSSet<UIScene*> *scenes = UIApplication.sharedApplication.connectedScenes;
  for (UIScene* scene in scenes) {
      UIWindowScene* winScene = ((UIWindowScene*)scene);
      winScene.titlebar.titleVisibility = UITitlebarTitleVisibilityHidden;
      winScene.titlebar.toolbar = nil;
      winScene.sizeRestrictions.minimumSize = CGSizeMake(400, 550);
      winScene.sizeRestrictions.maximumSize = CGSizeMake(400, 550);
  }

  AppKitBundleLoader *bundle = [[AppKitBundleLoader alloc] init];
  [[bundle appKitBridge] setConnectionStatus:false];

  [[NSNotificationCenter defaultCenter]
      addObserverForName:NSNotification.kVpnConnected
                  object:nil
                   queue:nil
              usingBlock:^(NSNotification *_Nonnull notification) {
                [[bundle appKitBridge] setConnectionStatus:YES];
              }];
  [[NSNotificationCenter defaultCenter]
      addObserverForName:NSNotification.kVpnDisconnected
                  object:nil
                   queue:nil
              usingBlock:^(NSNotification *_Nonnull notification) {
                [[bundle appKitBridge] setConnectionStatus:NO];
              }];

    [[bundle appKitBridge] setAppLauncherEnabled:true];
#endif

  [super application:application didFinishLaunchingWithOptions:launchOptions];

  return YES;
}

@end
