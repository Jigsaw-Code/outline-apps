package org.outline.log;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.util.Log;
import io.sentry.event.EventBuilder;
import io.sentry.event.helper.EventBuilderHelper;
import io.sentry.event.interfaces.UserInterface;
import io.sentry.util.Util;
import java.util.HashMap;
import java.util.Map;

/**
 * EventBuilderHelper that makes use of Android Context to populate some Event fields.
 *
 * This class replicates verbatim a subset of the functionality of AndroidEventBuilderHelper
 * https://github.com/getsentry/sentry-java/blob/master/sentry-android/src/main/java/io/sentry/android/event/helper/AndroidEventBuilderHelper.java
 *
 * The main difference lies in its treatment of the Android UUID, which is considered PII
 * by Outline, and therefore not desirable to be transmitted. We have also limited some data
 * collection and added fields for device country and locale.
 *
 */
public class DataSensitiveAndroidEventBuilderHelper implements EventBuilderHelper {
  public static final String TAG = "DataSensitiveAndroidEventBuilderHelper";

  private Context ctx;

  /**
   * Construct given the provided Android {@link Context}.
   *
   * @param ctx Android application context.
   */
  public DataSensitiveAndroidEventBuilderHelper(Context ctx) {
      this.ctx = ctx;
  }

  @Override
  public void helpBuildingEvent(EventBuilder eventBuilder) {
    eventBuilder.withSdkIntegration("android");
    PackageInfo packageInfo = getPackageInfo(ctx);
    if (packageInfo != null) {
        eventBuilder.withRelease(packageInfo.versionName);
        eventBuilder.withDist(Integer.toString(packageInfo.versionCode));
    }
    /**
     * TODO(alalama): generate a random ID for the user, store locally, and
     * add it as a UserInterface to the event builder.
     */
    eventBuilder.withContexts(getContexts());
  }

  private Map<String, Map<String, Object>> getContexts() {
    Map<String, Map<String, Object>> contexts = new HashMap<String, Map<String, Object>>();
    Map<String, Object> deviceMap = new HashMap<String, Object>();
    Map<String, Object> osMap     = new HashMap<String, Object>();
    Map<String, Object> appMap    = new HashMap<String, Object>();
    contexts.put("os", osMap);
    contexts.put("device", deviceMap);
    contexts.put("app", appMap);

    // Device
    deviceMap.put("arch", Build.CPU_ABI);
    deviceMap.put("online", isConnected(ctx));
    deviceMap.put("locale", getDeviceLocale());
    deviceMap.put("country", getNetworkCountry());

    // Operating System
    osMap.put("name", "Android");
    osMap.put("version", Build.VERSION.RELEASE);
    osMap.put("build", Build.DISPLAY);

    // App
    PackageInfo packageInfo = getPackageInfo(ctx);
    if (packageInfo != null) {
      appMap.put("app_version", packageInfo.versionName);
      appMap.put("app_build", packageInfo.versionCode);
      appMap.put("app_identifier", packageInfo.packageName);
    }

    return contexts;
  }

  /**
   * Return the Application's PackageInfo if possible, or null.
   *
   * @param ctx Android application context
   * @return the Application's PackageInfo if possible, or null
   */
  private static PackageInfo getPackageInfo(Context ctx) {
    try {
      return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
    } catch (PackageManager.NameNotFoundException e) {
      Log.e(TAG, "Error getting package info.", e);
      return null;
    }
  }

  /**
   * Returns the locale of the device.
   */
  private String getDeviceLocale() {
    return this.ctx.getResources().getConfiguration().locale.getDisplayName();
  }

  /**
   * Returns the ISO country code of the device's registered network.
   */
  private String getNetworkCountry() {
    TelephonyManager tm = (TelephonyManager)this.ctx.getSystemService(Context.TELEPHONY_SERVICE);
    return tm.getNetworkCountryIso();
  }

  /**
   * Check whether the application has internet access at a point in time.
   *
   * @param ctx Android application context
   * @return true if the application has internet access
   */
  private static boolean isConnected(Context ctx) {
    ConnectivityManager connectivityManager =
        (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
    return activeNetworkInfo != null && activeNetworkInfo.isConnected();
  }
}
