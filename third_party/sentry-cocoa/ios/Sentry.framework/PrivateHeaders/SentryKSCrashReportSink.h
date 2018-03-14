//
//  SentryKSCrashReportSink.h
//  Sentry
//
//  Created by Daniel Griesser on 10/05/2017.
//  Copyright © 2017 Sentry. All rights reserved.
//

#import <Foundation/Foundation.h>

#if __has_include(<KSCrash/KSCrash.h>)
#import <KSCrash/KSCrash.h>
#elif __has_include("KSCrash.h")
#import "KSCrash.h"
#endif

#if WITH_KSCRASH
@interface SentryKSCrashReportSink : NSObject <KSCrashReportFilter>
#else

@interface SentryKSCrashReportSink : NSObject
#endif

@end
