#import <Foundation/Foundation.h>
#import "AppDelegate+Outline.h"
#import <objc/runtime.h>
#import "AppKitBridge-Bridging-Header.h"
#import "Outline-Swift.h"

#if TARGET_OS_MACCATALYST
@import ServiceManagement;
#endif

@implementation AppDelegate (Outline)

#pragma mark - Lifecycle

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:
        (NSDictionary<UIApplicationLaunchOptionsKey, id> *)launchOptions {
#if TARGET_OS_MACCATALYST
  // Configure the Catalyst window.
  NSSet<UIScene *> *scenes = UIApplication.sharedApplication.connectedScenes;
  for (UIScene *scene in scenes) {
    UIWindowScene *winScene = ((UIWindowScene *)scene);
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

  // Enable app launcher to start on boot.
  [[bundle appKitBridge] setAppLauncherEnabled:true];
#endif

  [super application:application didFinishLaunchingWithOptions:launchOptions];

  return YES;
}

@end
