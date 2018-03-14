//
//  SentryKSCrashInstallation.h
//  Sentry
//
//  Created by Daniel Griesser on 10/05/2017.
//  Copyright © 2017 Sentry. All rights reserved.
//

#import <Foundation/Foundation.h>

#if __has_include(<KSCrash/KSCrash.h>)
#import <KSCrash/KSCrash.h>
#import <KSCrash/KSCrashInstallation.h>
#elif __has_include("KSCrash.h")
#import "KSCrash.h"
#import "KSCrashInstallation.h"
#endif

#if WITH_KSCRASH
@interface SentryKSCrashInstallation : KSCrashInstallation
#else
@interface SentryKSCrashInstallation : NSObject
#endif

- (void)sendAllReports;

@end

