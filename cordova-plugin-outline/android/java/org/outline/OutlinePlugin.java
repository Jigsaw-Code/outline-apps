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

package org.outline;

import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.net.VpnService;
import android.os.IBinder;
import android.support.v4.content.LocalBroadcastManager;
import android.util.Pair;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.outline.log.OutlineLogger;
import org.outline.shadowsocks.ShadowsocksConnectivity;
import org.outline.vpn.VpnTunnelService;

public class OutlinePlugin extends CordovaPlugin {
  private static final Logger LOG = Logger.getLogger(OutlinePlugin.class.getName());

  // Actions supported by this plugin.
  public enum Action {
    START("start"),
    STOP("stop"),
    ON_STATUS_CHANGE("onStatusChange"),
    IS_RUNNING("isRunning"),
    IS_REACHABLE("isReachable"),
    INIT_ERROR_REPORTING("initializeErrorReporting"),
    REPORT_EVENTS("reportEvents"),
    QUIT("quitApplication");

    private final static Map<String, Action> actions = new HashMap<String, Action>();
    static {
      for (Action action : Action.values()) {
        actions.put(action.value, action);
      }
    }

    // Returns whether |value| is a defined action.
    public static boolean hasValue(final String value) {
      return actions.containsKey(value);
    }

    public final String value;
    Action(final String value) {
      this.value = value;
    }

    // Returns whether |action| is the underlying value of this instance.
    public boolean is(final String action) {
      return this.value.equals(action);
    }
  }

  // Plugin error codes. Keep in sync with outlinePlugin.js.
  public enum ErrorCode {
    NO_ERROR(0),
    UNEXPECTED(1),
    VPN_PERMISSION_NOT_GRANTED(2),
    INVALID_SERVER_CREDENTIALS(3),
    UDP_RELAY_NOT_ENABLED(4),
    SERVER_UNREACHABLE(5),
    VPN_START_FAILURE(6),
    ILLEGAL_SERVER_CONFIGURATION(7),
    SHADOWSOCKS_START_FAILURE(8),
    CONFIGURE_SYSTEM_PROXY_FAILURE (9),
    NO_ADMIN_PERMISSIONS (10),
    UNSUPPORTED_ROUTING_TABLE (11),
    SYSTEM_MISCONFIGURED (12);

    public final int value;
    ErrorCode(int value) {
      this.value = value;
    }
  }

  public enum ConnectionStatus {
    INVALID(-1), // Internal use only.
    CONNECTED(0),
    DISCONNECTED(1),
    RECONNECTING(2);

    public final int value;
    ConnectionStatus(int value) {
      this.value = value;
    }
  }

  // Extra parameters for Intent broadcasting.
  public enum IntentExtra {
    CONNECTION_ID("connectionExtra"),
    PAYLOAD("payloadExtra"),
    ERROR_CODE("errorCodeExtra");

    public final String value;
    IntentExtra(final String value) {
      this.value = value;
    }
  }

  private static final int REQUEST_CODE_PREPARE_VPN = 100;
  private static final int RESULT_OK = -1; // Standard activity result: operation succeeded.
  private static final HashSet<String> CONNECTION_INSTANCE_ACTIONS =
      new HashSet<String>(Arrays.asList(Action.START.value, Action.STOP.value,
          Action.IS_RUNNING.value, Action.ON_STATUS_CHANGE.value, Action.IS_REACHABLE.value));

  private VpnTunnelService vpnTunnelService = null;
  private String startRequestConnectionId = null;
  private JSONObject startRequestConfig = null;
  private Map<Pair<String, String>, CallbackContext> listeners = new ConcurrentHashMap();

  // Class to bind to VpnTunnelService.
  private ServiceConnection serviceConnection =
      new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder binder) {
          vpnTunnelService = ((VpnTunnelService.LocalBinder) binder).getService();
        }

        @Override
        public void onServiceDisconnected(ComponentName className) {
          vpnTunnelService = null;
        }
      };

  @Override
  protected void pluginInitialize() {
    OutlineLogger.initializeLogging();

    Context context = getBaseContext();
    IntentFilter broadcastFilter = new IntentFilter();
    broadcastFilter.addAction(Action.START.value);
    broadcastFilter.addAction(Action.STOP.value);
    broadcastFilter.addAction(Action.ON_STATUS_CHANGE.value);
    LocalBroadcastManager.getInstance(context)
        .registerReceiver(vpnTunnelBroadcastReceiver, broadcastFilter);

    context.bindService(
        new Intent(context, VpnTunnelService.class), serviceConnection, Context.BIND_AUTO_CREATE);
  }

  @Override
  public void onDestroy() {
    Context context = getBaseContext();
    LocalBroadcastManager.getInstance(context).unregisterReceiver(vpnTunnelBroadcastReceiver);
    context.unbindService(serviceConnection);
  }

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext)
      throws JSONException {
    if (!Action.hasValue(action)) {
      return false;
    }
    if (Action.QUIT.is(action)) {
      this.cordova.getActivity().finish();
      return true;
    }

    String connectionId = null;
    if (isConnectionInstanceAction(action)) {
      // Instance actions rely on the connection id in order to retrieve callbacks.
      connectionId = args.getString(0);
      addListener(connectionId, action, callbackContext);
    }
    LOG.fine(String.format(Locale.ROOT, "action: %s, connection ID: %s", action, connectionId));

    if (Action.ON_STATUS_CHANGE.is(action)) {
      return true; // We have already set the callback listener for this action.
    }
    executeAsync(connectionId, action, args, callbackContext);
    return true;
  }

  // Executes an action asynchronously through the Cordova thread pool.
  protected void executeAsync(
      final String connectionId,
      final String action,
      final JSONArray args,
      final CallbackContext callback) {
    cordova
        .getThreadPool()
        .execute(
            new Runnable() {
              @Override
              public void run() {
                try {
                  // Connection instance actions
                  if (Action.START.is(action)) {
                    // Set instance variables in case we need to start the VPN service from
                    // onActivityResult
                    startRequestConnectionId = connectionId;
                    startRequestConfig = args.getJSONObject(1);
                    prepareAndStartVpnConnection();
                  } else if (Action.STOP.is(action)) {
                    stopVpnConnection(connectionId);
                  } else if (Action.IS_REACHABLE.is(action)) {
                    boolean isReachable =
                        ShadowsocksConnectivity.isServerReachable(
                            args.getString(1), args.getInt(2));
                    PluginResult result = new PluginResult(PluginResult.Status.OK, isReachable);
                    sendPluginResult(connectionId, action, result, false);
                  } else if (Action.IS_RUNNING.is(action)) {
                    PluginResult result =
                        new PluginResult(PluginResult.Status.OK, isConnectionActive(connectionId));
                    sendPluginResult(connectionId, action, result, false);

                    // Static actions
                  } else if (Action.INIT_ERROR_REPORTING.is(action)) {
                    final String apiKey = args.getString(0);
                    OutlineLogger.initializeErrorReporting(getBaseContext(), apiKey);
                    callback.success();
                  } else if (Action.REPORT_EVENTS.is(action)) {
                    final String uuid = args.getString(0);
                    OutlineLogger.sendLogs(uuid);
                    callback.success();
                  } else {
                    LOG.severe(
                        String.format(Locale.ROOT, "Unexpected asynchronous action %s", action));
                    callback.error(ErrorCode.UNEXPECTED.value);
                  }
                } catch (Exception e) {
                  LOG.log(Level.SEVERE, "Unexpected error while executing action.", e);
                  if (isConnectionInstanceAction(action)) {
                    PluginResult pluginResult =
                        new PluginResult(PluginResult.Status.ERROR, ErrorCode.UNEXPECTED.value);
                    sendPluginResult(connectionId, action, pluginResult, false);
                  } else {
                    callback.error(ErrorCode.UNEXPECTED.value);
                  }
                }
              }
            });
  }

  private void prepareAndStartVpnConnection() {
    if (prepareVpnService()) {
      startVpnConnection();
    }
  }

  // Requests user permission to connect the VPN. Returns true if permission was previously granted,
  // and false if the OS prompt will be displayed.
  private boolean prepareVpnService() throws ActivityNotFoundException {
    LOG.fine("Preparing VPN.");
    Intent prepareVpnIntent = VpnService.prepare(getBaseContext());
    if (prepareVpnIntent != null) {
      LOG.info("prepare VPN with activity");
      cordova.setActivityResultCallback(OutlinePlugin.this);
      cordova.getActivity().startActivityForResult(prepareVpnIntent, REQUEST_CODE_PREPARE_VPN);
      return false;
    }
    return true;
  }

  @Override
  public void onActivityResult(int request, int result, Intent data) {
    if (request != REQUEST_CODE_PREPARE_VPN) {
      LOG.warning("Received non-requested activity result.");
      return;
    }
    if (result != RESULT_OK) {
      LOG.severe("Failed to prepare VPN.");
      PluginResult pluginResult =
          new PluginResult(PluginResult.Status.ERROR, ErrorCode.VPN_PERMISSION_NOT_GRANTED.value);
      sendPluginResult(startRequestConnectionId, Action.START.value, pluginResult, false);
      return;
    }
    try {
      startVpnConnection();
    } catch (Exception e) {
      // Do not propagate the exception in the main thread; the service will broadcast the error.
    }
  }

  private void startVpnConnection() {
    LOG.info("Starting VPN connection");
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(Action.START, startRequestConnectionId);
      return;
    }
    vpnTunnelService.startConnection(startRequestConnectionId, startRequestConfig);
  }

  private void stopVpnConnection(final String connectionId) {
    LOG.info("Stopping VPN connection.");
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(Action.STOP, connectionId);
      return;
    }
    vpnTunnelService.stopConnection(connectionId);
  }

  // Returns whether the VPN service is running a particular connection.
  private boolean isConnectionActive(final String connectionId) {
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(Action.IS_RUNNING, connectionId);
      return false;
    }
    return vpnTunnelService.isConnectionActive(connectionId);
  }

  // Helpers

  private Context getBaseContext() {
    return this.cordova.getActivity().getApplicationContext();
  }

  // Adds a |callbackContext| to the |listeners| map, keying by |connectionId| and |action|.
  // We allow a single callback per connection instance and action.
  private void addListener(String connectionId, String action, CallbackContext callbackContext) {
    final Pair<String, String> key = new Pair(connectionId, action);
    listeners.put(key, callbackContext);
  }

  // Returns whether |action| is a method of a JS Connection instance.
  private boolean isConnectionInstanceAction(final String action) {
    return CONNECTION_INSTANCE_ACTIONS.contains(action);
  }

  private void onVpnTunnelServiceNotBound(final Action action, final String connectionId) {
    LOG.severe("VPN service not bound.");
    PluginResult result =
        new PluginResult(PluginResult.Status.ERROR, OutlinePlugin.ErrorCode.UNEXPECTED.value);
    sendPluginResult(connectionId, action.value, result, false);
  }

  // Broadcasts

  private VpnTunnelBroadcastReceiver vpnTunnelBroadcastReceiver =
      new VpnTunnelBroadcastReceiver(OutlinePlugin.this);

  private class VpnTunnelBroadcastReceiver extends BroadcastReceiver {
    private OutlinePlugin outlinePlugin;

    public VpnTunnelBroadcastReceiver(OutlinePlugin outlinePlugin) {
      this.outlinePlugin = outlinePlugin;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
      final String action = intent.getAction();
      String connectionId = intent.getStringExtra(IntentExtra.CONNECTION_ID.value);
      int errorCode = intent.getIntExtra(IntentExtra.ERROR_CODE.value, ErrorCode.UNEXPECTED.value);
      LOG.fine(String.format(
          Locale.ROOT, "Service broadcast: %s, %s, %d", action, connectionId, errorCode));

      PluginResult result;
      boolean keepCallback = false;
      if (errorCode == ErrorCode.NO_ERROR.value) {
        if (Action.ON_STATUS_CHANGE.is(action)) {
          int status =
              intent.getIntExtra(IntentExtra.PAYLOAD.value, ConnectionStatus.INVALID.value);
          if (status == ConnectionStatus.INVALID.value) {
            LOG.warning("Failed to retrieve connection status.");
            return;
          }
          result = new PluginResult(PluginResult.Status.OK, status);
          keepCallback = true;
        } else {
          result = new PluginResult(PluginResult.Status.OK);
        }
      } else {
        result = new PluginResult(PluginResult.Status.ERROR, errorCode);
      }
      outlinePlugin.sendPluginResult(connectionId, action, result, keepCallback);
    }
  };

  public void sendPluginResult(
      final String connectionId,
      final String action,
      final PluginResult result,
      boolean keepCallback) {
    if (connectionId == null || action == null) {
      LOG.warning(String.format(Locale.ROOT,
          "failed to retrieve listener for connection ID %s, action %s", connectionId, action));
      return;
    }
    final Pair<String, String> key = new Pair(connectionId, action);
    if (!listeners.containsKey(key)) {
      LOG.warning(String.format(Locale.ROOT,
          "failed to retrieve listener for connection ID %s, action %s", connectionId, action));
      return;
    }

    CallbackContext callbackContext = listeners.get(key);
    if (keepCallback) {
      // Perennial listener for events.
      result.setKeepCallback(true);
    } else {
      // Single-use listener for a promise command.
      listeners.remove(key);
    }
    callbackContext.sendPluginResult(result);
  }
}
