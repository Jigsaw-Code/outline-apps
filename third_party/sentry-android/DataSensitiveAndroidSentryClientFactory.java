package org.outline.log;

import android.content.Context;
import android.util.Log;
import io.sentry.android.AndroidSentryClientFactory;
import io.sentry.android.event.helper.AndroidEventBuilderHelper;
import io.sentry.dsn.Dsn;
import io.sentry.event.helper.EventBuilderHelper;
import io.sentry.SentryClient;

/**
 * SentryClientFactory that handles Outline-specific construction. Its primary use case
 * is enabling the use of a custom EventBuilderHelper.
 */
public class DataSensitiveAndroidSentryClientFactory extends AndroidSentryClientFactory {
  private static final String LOG_TAG = "DataSensitiveAndroidSentryClientFactory";

  private Context context;

  /**
   * Construct a DataSensitiveAndroidSentryClientFactory.
   *
   * @param context, Android application context
   */
  public DataSensitiveAndroidSentryClientFactory(Context context) {
    super(context);
    this.context = context;
  }

  @Override
  public SentryClient createSentryClient(Dsn dsn) {
    SentryClient sentryClientInstance = super.createSentryClient(dsn);
    // Remove the default event builder helper, which sends the Android UUID by
    // default; replace it with our custom event builder helper.
    removeAndroidEventBuilderHelper(sentryClientInstance);
    sentryClientInstance.addBuilderHelper(new DataSensitiveAndroidEventBuilderHelper(this.context));
    return sentryClientInstance;
  }

  // Removes the AndroidEventBuilderHelper, added by AndroidSentryClientFactory.
  private void removeAndroidEventBuilderHelper(SentryClient sentryClientInstance) {
    for (EventBuilderHelper helper : sentryClientInstance.getBuilderHelpers()) {
      if (helper instanceof AndroidEventBuilderHelper) {
        Log.d(LOG_TAG, "Removing the Android event builder helper");
        sentryClientInstance.removeBuilderHelper(helper);
        return;
      }
    }
    Log.w(LOG_TAG, "Failed to remove the Android event builder helper");
  }
};
