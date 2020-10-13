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
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.os.Messenger;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
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
import org.outline.log.SentryErrorReporter;
import org.outline.shadowsocks.ShadowsocksConnectivity;
import org.outline.vpn.VpnServiceStarter;
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

    private final static Map<String, Action> actions = new HashMap<>();
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
    CONFIGURE_SYSTEM_PROXY_FAILURE(9),
    NO_ADMIN_PERMISSIONS(10),
    UNSUPPORTED_ROUTING_TABLE(11),
    SYSTEM_MISCONFIGURED(12);

    public final int value;
    ErrorCode(int value) {
      this.value = value;
    }
  }

  public enum TunnelStatus {
    INVALID(-1), // Internal use only.
    CONNECTED(0),
    DISCONNECTED(1),
    RECONNECTING(2);

    public final int value;
    TunnelStatus(int value) {
      this.value = value;
    }
  }

  // IPC message parameters.
  public enum MessageData {
    TUNNEL_ID("tunnelId"),
    TUNNEL_CONFIG("tunnelConfig"),
    ACTION("action"),
    PAYLOAD("payload"),
    ERROR_REPORTING_API_KEY("errorReportingApiKey"),
    ERROR_CODE("errorCode");

    public final String value;
    MessageData(final String value) {
      this.value = value;
    }
  }

  private static final int REQUEST_CODE_PREPARE_VPN = 100;
  private static final int RESULT_OK = -1; // Standard activity result: operation succeeded.
  private static final HashSet<String> TUNNEL_INSTANCE_ACTIONS =
      new HashSet<>(Arrays.asList(Action.START.value, Action.STOP.value, Action.IS_RUNNING.value,
          Action.ON_STATUS_CHANGE.value, Action.IS_REACHABLE.value));

  final private Messenger vpnClientMessenger =
      new Messenger(new VpnServiceMessageHandler(OutlinePlugin.this));
  private Messenger vpnServiceMessenger;
  private String errorReportingApiKey;
  private String startRequestTunnelId = null;
  private JSONObject startRequestConfig = null;
  private Map<Pair<String, String>, CallbackContext> listeners = new ConcurrentHashMap<>();

  // Connection to the VPN service.
  private ServiceConnection vpnServiceConnection =
      new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder binder) {
          vpnServiceMessenger = new Messenger(binder);
          LOG.info("VPN service connected");
        }

        @Override
        public void onServiceDisconnected(ComponentName className) {
          vpnServiceMessenger = null;
          LOG.warning("VPN service disconnected");
          // Automatically reconnect the VPN if the service process crashed.
          Context context = getBaseContext();
          Intent reconnect = new Intent(context, VpnTunnelService.class);
          reconnect.putExtra(VpnServiceStarter.AUTOSTART_EXTRA, true);
          // Send the error reporting API key so the crash is reported.
          reconnect.putExtra(MessageData.ERROR_REPORTING_API_KEY.value, errorReportingApiKey);
          context.bindService(reconnect, vpnServiceConnection, Context.BIND_AUTO_CREATE);
        }
      };

  // Handler to process messages from the VPN service.
  private static class VpnServiceMessageHandler extends Handler {
    private OutlinePlugin plugin;

    VpnServiceMessageHandler(OutlinePlugin plugin) {
      this.plugin = plugin;
    }

    @Override
    public void handleMessage(@NonNull Message msg) {
      final Bundle data = msg.getData();
      final String action = data.getString(MessageData.ACTION.value);
      final String tunnelId = data.getString(MessageData.TUNNEL_ID.value);
      int errorCode = data.getInt(MessageData.ERROR_CODE.value, ErrorCode.UNEXPECTED.value);
      LOG.fine(
          String.format(Locale.ROOT, "Service message: %s, %s, %d", action, tunnelId, errorCode));

      PluginResult result;
      if (errorCode == ErrorCode.NO_ERROR.value) {
        if (Action.IS_RUNNING.is(action)) {
          boolean isRunning = data.getBoolean(MessageData.PAYLOAD.value, false);
          result = new PluginResult(PluginResult.Status.OK, isRunning);
        } else {
          result = new PluginResult(PluginResult.Status.OK);
        }
      } else {
        result = new PluginResult(PluginResult.Status.ERROR, errorCode);
      }
      plugin.sendPluginResult(tunnelId, action, result, false);
    }
  }

  @Override
  protected void pluginInitialize() {
    OutlineLogger.registerLogHandler(SentryErrorReporter.BREADCRUMB_LOG_HANDLER);
    Context context = getBaseContext();
    IntentFilter broadcastFilter = new IntentFilter();
    broadcastFilter.addAction(Action.ON_STATUS_CHANGE.value);
    broadcastFilter.addCategory(context.getPackageName());
    context.registerReceiver(vpnTunnelBroadcastReceiver, broadcastFilter);

    context.bindService(new Intent(context, VpnTunnelService.class), vpnServiceConnection,
        Context.BIND_AUTO_CREATE);
  }

  @Override
  public void onDestroy() {
    Context context = getBaseContext();
    context.unregisterReceiver(vpnTunnelBroadcastReceiver);
    context.unbindService(vpnServiceConnection);
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

    String tunnelId = null;
    if (isTunnelInstanceAction(action)) {
      // Instance actions rely on the tunnel id in order to retrieve callbacks.
      tunnelId = args.getString(0);
      addListener(tunnelId, action, callbackContext);
    }
    LOG.fine(String.format(Locale.ROOT, "action: %s, tunnel ID: %s", action, tunnelId));

    if (Action.ON_STATUS_CHANGE.is(action)) {
      return true; // We have already set the callback listener for this action.
    }
    executeAsync(tunnelId, action, args, callbackContext);
    return true;
  }

  // Executes an action asynchronously through the Cordova thread pool.
  protected void executeAsync(final String tunnelId, final String action, final JSONArray args,
      final CallbackContext callback) {
    cordova.getThreadPool().execute(() -> {
      try {
        // Tunnel instance actions
        if (Action.START.is(action)) {
          // Set instance variables in case we need to start the VPN service from
          // onActivityResult
          startRequestTunnelId = tunnelId;
          startRequestConfig = args.getJSONObject(1);
          prepareAndStartVpn();
        } else if (Action.STOP.is(action)) {
          stopVpnTunnel(tunnelId);
        } else if (Action.IS_RUNNING.is(action)) {
          isTunnelActive(tunnelId);
        } else if (Action.IS_REACHABLE.is(action)) {
          boolean isReachable =
              ShadowsocksConnectivity.isServerReachable(args.getString(1), args.getInt(2));
          PluginResult result = new PluginResult(PluginResult.Status.OK, isReachable);
          sendPluginResult(tunnelId, action, result, false);

          // Static actions
        } else if (Action.INIT_ERROR_REPORTING.is(action)) {
          errorReportingApiKey = args.getString(0);
          SentryErrorReporter.init(getBaseContext(), errorReportingApiKey);
          initVpnErrorReporting(errorReportingApiKey);
          callback.success();
        } else if (Action.REPORT_EVENTS.is(action)) {
          final String uuid = args.getString(0);
          SentryErrorReporter.send(uuid);
          callback.success();
        } else {
          LOG.severe(String.format(Locale.ROOT, "Unexpected asynchronous action %s", action));
          callback.error(ErrorCode.UNEXPECTED.value);
        }
      } catch (Exception e) {
        LOG.log(Level.SEVERE, "Unexpected error while executing action.", e);
        if (isTunnelInstanceAction(action)) {
          PluginResult pluginResult =
              new PluginResult(PluginResult.Status.ERROR, ErrorCode.UNEXPECTED.value);
          sendPluginResult(tunnelId, action, pluginResult, false);
        } else {
          callback.error(ErrorCode.UNEXPECTED.value);
        }
      }
    });
  }

  private void prepareAndStartVpn() {
    if (prepareVpnService()) {
      startVpnTunnel();
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
      sendPluginResult(startRequestTunnelId, Action.START.value, pluginResult, false);
      return;
    }
    try {
      startVpnTunnel();
    } catch (Exception e) {
      // Do not propagate the exception in the main thread; the service will broadcast the error.
    }
  }

  private void startVpnTunnel() {
    LOG.info("Starting VPN Tunnel");
    final Bundle data = new Bundle();
    data.putString(MessageData.TUNNEL_CONFIG.value, startRequestConfig.toString());
    sendVpnServiceMessage(Action.START, startRequestTunnelId, data);
  }

  private void stopVpnTunnel(final String tunnelId) {
    LOG.info("Stopping VPN tunnel.");
    sendVpnServiceMessage(Action.STOP, tunnelId, null);
  }

  // Returns whether the VPN service is running a particular tunnel instance.
  private void isTunnelActive(final String tunnelId) {
    sendVpnServiceMessage(Action.IS_RUNNING, tunnelId, null);
  }

  // Initializes the error reporting framework on the VPN process.
  private void initVpnErrorReporting(final String apiKey) {
    Bundle data = new Bundle();
    data.putString(MessageData.ERROR_REPORTING_API_KEY.value, apiKey);
    sendVpnServiceMessage(Action.INIT_ERROR_REPORTING, null, data);
  }

  // Sends a message to the VPN service through its messenger. The VPN service must be bound.
  void sendVpnServiceMessage(
      final Action action, @Nullable final String tunnelId, @Nullable Bundle args) {
    if (vpnServiceMessenger == null) {
      onVpnTunnelServiceNotBound(action, tunnelId);
      return;
    }
    Bundle data = args == null ? new Bundle() : new Bundle(args);
    data.putString(MessageData.ACTION.value, action.value);
    if (tunnelId != null) {
      data.putString(MessageData.TUNNEL_ID.value, tunnelId);
    }

    Message msg = Message.obtain();
    msg.setData(data);
    msg.replyTo = vpnClientMessenger;
    try {
      vpnServiceMessenger.send(msg);
    } catch (Exception e) {
      LOG.log(Level.SEVERE,
          String.format(Locale.ROOT,
              "Failed to send message to VPN service for action %s and tunnel ID %s", action,
              tunnelId),
          e);
      onVpnTunnelServiceNotBound(action, tunnelId);
    }
  }

  // Helpers

  private Context getBaseContext() {
    return this.cordova.getActivity().getApplicationContext();
  }

  // Adds a |callbackContext| to the |listeners| map, keying by |tunnelId| and |action|.
  // We allow a single callback per tunnel instance and action.
  private void addListener(String tunnelId, String action, CallbackContext callbackContext) {
    final Pair<String, String> key = new Pair(tunnelId, action);
    listeners.put(key, callbackContext);
  }

  // Returns whether |action| is a method of a JS Tunnel instance.
  private boolean isTunnelInstanceAction(final String action) {
    return TUNNEL_INSTANCE_ACTIONS.contains(action);
  }

  private void onVpnTunnelServiceNotBound(final Action action, final String tunnelId) {
    LOG.severe("VPN service not bound.");
    PluginResult result =
        new PluginResult(PluginResult.Status.ERROR, OutlinePlugin.ErrorCode.UNEXPECTED.value);
    sendPluginResult(tunnelId, action.value, result, false);
  }

  // Broadcasts

  private VpnTunnelBroadcastReceiver vpnTunnelBroadcastReceiver =
      new VpnTunnelBroadcastReceiver(OutlinePlugin.this);

  private static class VpnTunnelBroadcastReceiver extends BroadcastReceiver {
    private OutlinePlugin outlinePlugin;

    public VpnTunnelBroadcastReceiver(OutlinePlugin outlinePlugin) {
      this.outlinePlugin = outlinePlugin;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
      final String tunnelId = intent.getStringExtra(MessageData.TUNNEL_ID.value);
      int status = intent.getIntExtra(MessageData.PAYLOAD.value, TunnelStatus.INVALID.value);
      LOG.fine(String.format(Locale.ROOT, "VPN connectivity changed: %s, %d", tunnelId, status));

      PluginResult result = new PluginResult(PluginResult.Status.OK, status);
      outlinePlugin.sendPluginResult(tunnelId, Action.ON_STATUS_CHANGE.value, result, true);
    }
  };

  public void sendPluginResult(
      final String tunnelId, final String action, final PluginResult result, boolean keepCallback) {
    if (tunnelId == null || action == null) {
      LOG.warning(String.format(Locale.ROOT,
          "failed to retrieve listener for tunnel ID %s, action %s", tunnelId, action));
      return;
    }
    final Pair<String, String> key = new Pair(tunnelId, action);
    if (!listeners.containsKey(key)) {
      LOG.warning(String.format(Locale.ROOT,
          "failed to retrieve listener for tunnel ID %s, action %s", tunnelId, action));
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
