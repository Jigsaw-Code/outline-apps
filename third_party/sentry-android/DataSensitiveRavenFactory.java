package org.outline.log;

import android.content.Context;
import android.util.Log;
import com.getsentry.raven.android.AndroidRavenFactory;
import com.getsentry.raven.android.event.helper.AndroidEventBuilderHelper;
import com.getsentry.raven.event.helper.EventBuilderHelper;
import com.getsentry.raven.buffer.Buffer;
import com.getsentry.raven.buffer.DiskBuffer;
import com.getsentry.raven.context.ContextManager;
import com.getsentry.raven.context.SingletonContextManager;
import com.getsentry.raven.dsn.Dsn;
import com.getsentry.raven.Raven;
import java.io.File;

/**
 * RavenFactory that handles Outline-specific construction. Its primary use case
 * is enabling the use of a custom EventBuilderHelper.
 */
public class DataSensitiveRavenFactory extends AndroidRavenFactory {
  private static final String LOG_TAG = "DataSensitiveRavenFactory";

  private Context context;

  /**
   * Construct a DataSensitiveRavenFactory.
   *
   * @param context, Android application context
   */
 public DataSensitiveRavenFactory(Context context) {
    super(context);
    this.context = context;
  }

  @Override
  public Raven createRavenInstance(Dsn dsn) {
    Raven ravenInstance = super.createRavenInstance(dsn);
    // Remove the default event builder helper, which sends the Android UUID by
    // default; replace it with our custom event builder helper.
    removeAndroidEventBuilderHelper(ravenInstance);
    ravenInstance.addBuilderHelper(new DataSensitiveAndroidEventBuilderHelper(this.context));
    return ravenInstance;
  }

  // Removes the AndroidEventBuilderHelper, added by AndroidRavenFactory.
  private void removeAndroidEventBuilderHelper(Raven ravenInstance) {
    for (EventBuilderHelper helper : ravenInstance.getBuilderHelpers()) {
      if (helper instanceof AndroidEventBuilderHelper) {
        Log.d(LOG_TAG, "Removing the Android event builder helper");
        ravenInstance.removeBuilderHelper(helper);
        return;
      }
    }
    Log.w(LOG_TAG, "Failed to remove the Android event builder helper");
  }
};
