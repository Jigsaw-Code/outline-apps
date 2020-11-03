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
import android.os.RemoteException;
import java.util.HashMap;
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
import org.outline.shadowsocks.ShadowsocksConfig;
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

  // IPC message and intent parameters.
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

  private IVpnTunnelService vpnTunnelService;
  private String errorReportingApiKey;
  private String startRequestTunnelId;
  private JSONObject startRequestConfig;
  private String startCallbackId;
  // Tunnel status change callback ID by tunnel ID.
  private Map<String, String> tunnelStatusListeners = new ConcurrentHashMap<>();

  // Connection to the VPN service.
  private ServiceConnection vpnServiceConnection = new ServiceConnection() {
    @Override
    public void onServiceConnected(ComponentName className, IBinder binder) {
      vpnTunnelService = IVpnTunnelService.Stub.asInterface(binder);
      LOG.info("VPN service connected");
    }

    @Override
    public void onServiceDisconnected(ComponentName className) {
      vpnTunnelService = null;
      LOG.warning("VPN service disconnected");
      // Rebind the service so the VPN automatically reconnects if the service process crashed.
      Context context = getBaseContext();
      Intent reconnect = new Intent(context, VpnTunnelService.class);
      reconnect.putExtra(VpnServiceStarter.AUTOSTART_EXTRA, true);
      // Send the error reporting API key so the potential crash is reported.
      reconnect.putExtra(MessageData.ERROR_REPORTING_API_KEY.value, errorReportingApiKey);
      context.bindService(reconnect, vpnServiceConnection, Context.BIND_AUTO_CREATE);
    }
  };

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

    LOG.fine(String.format(Locale.ROOT, "Received action: %s", action));

    if (Action.ON_STATUS_CHANGE.is(action)) {
      // Store the callback ID so we can execute it asynchronously.
      final String tunnelId = args.getString(0);
      tunnelStatusListeners.put(tunnelId, callbackContext.getCallbackId());
      return true;
    }
    executeAsync(action, args, callbackContext);
    return true;
  }

  // Executes an action asynchronously through the Cordova thread pool.
  protected void executeAsync(
      final String action, final JSONArray args, final CallbackContext callback) {
    cordova.getThreadPool().execute(() -> {
      try {
        // Tunnel instance actions: tunnel ID is always the first argument.
        if (Action.START.is(action)) {
          prepareAndStartVpn(args.getString(0), args.getJSONObject(1), callback.getCallbackId());
        } else if (Action.STOP.is(action)) {
          stopVpnTunnel(args.getString(0), callback.getCallbackId());
        } else if (Action.IS_RUNNING.is(action)) {
          isTunnelActive(args.getString(0), callback.getCallbackId());
        } else if (Action.IS_REACHABLE.is(action)) {
          boolean isReachable =
              ShadowsocksConnectivity.isServerReachable(args.getString(1), args.getInt(2));
          PluginResult result = new PluginResult(PluginResult.Status.OK, isReachable);
          callback.sendPluginResult(result);

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
        callback.error(ErrorCode.UNEXPECTED.value);
      }
    });
  }

  private void prepareAndStartVpn(
      final String tunnelId, final JSONObject config, final String callbackId) {
    if (prepareVpnService()) {
      startVpnTunnel(tunnelId, config, callbackId);
    } else {
      // Set instance variables so we can start the VPN service from `onActivityResult` after the
      // user has granted permission.
      startRequestTunnelId = tunnelId;
      startRequestConfig = config;
      startCallbackId = callbackId;
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
      sendPluginResult(startCallbackId, pluginResult);
      return;
    }
    startVpnTunnel(startRequestTunnelId, startRequestConfig, startCallbackId);
  }

  private void startVpnTunnel(
      final String tunnelId, final JSONObject config, final String callbackId) {
    LOG.info("Starting VPN Tunnel");
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(callbackId);
      return;
    }
    final TunnelConfig tunnelConfig = new TunnelConfig();
    tunnelConfig.id = tunnelId;
    tunnelConfig.proxy = new ShadowsocksConfig();
    try {
      tunnelConfig.name = config.getString("name");
      tunnelConfig.proxy.host = config.getString("host");
      tunnelConfig.proxy.port = config.getInt("port");
      tunnelConfig.proxy.password = config.getString("password");
      tunnelConfig.proxy.method = config.getString("method");
    } catch (JSONException e) {
      LOG.log(Level.SEVERE, "Failed to retrieve the tunnel proxy config.", e);
      sendPluginResult(callbackId, ErrorCode.ILLEGAL_SERVER_CONFIGURATION.value);
      return;
    }
    try {
      int errorCode = vpnTunnelService.startTunnel(tunnelConfig);
      sendPluginResult(callbackId, errorCode);
    } catch (RemoteException e) {
      onVpnTunnelServiceNotBound(callbackId);
    }
  }

  private void stopVpnTunnel(final String tunnelId, final String callbackId) {
    LOG.info("Stopping VPN tunnel.");
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(callbackId);
      return;
    }
    try {
      int errorCode = vpnTunnelService.stopTunnel(tunnelId);
      sendPluginResult(callbackId, errorCode);
    } catch (RemoteException e) {
      onVpnTunnelServiceNotBound(callbackId);
    }
  }

  // Returns whether the VPN service is running a particular tunnel instance.
  private void isTunnelActive(final String tunnelId, final String callbackId) {
    if (vpnTunnelService == null) {
      onVpnTunnelServiceNotBound(callbackId);
      return;
    }
    boolean isActive = false;
    try {
      isActive = vpnTunnelService.isTunnelActive(tunnelId);
    } catch (Exception e) {
      LOG.log(Level.SEVERE,
          String.format(Locale.ROOT, "Failed to determine if tunnel is active: %s", tunnelId), e);
    }
    PluginResult result = new PluginResult(PluginResult.Status.OK, isActive);
    sendPluginResult(callbackId, result);
  }

  // Initializes the error reporting framework on the VPN process.
  private void initVpnErrorReporting(final String apiKey) {
    try {
      vpnTunnelService.initErrorReporting(apiKey);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to initialize error reporting on the VPN service process", e);
    }
  }

  // Helpers

  private Context getBaseContext() {
    return this.cordova.getActivity().getApplicationContext();
  }

  private void onVpnTunnelServiceNotBound(final String callbackId) {
    LOG.severe("VPN service not bound.");
    PluginResult result =
        new PluginResult(PluginResult.Status.ERROR, OutlinePlugin.ErrorCode.UNEXPECTED.value);
    sendPluginResult(callbackId, result);
  }

  // Broadcasts

  private VpnTunnelBroadcastReceiver vpnTunnelBroadcastReceiver =
      new VpnTunnelBroadcastReceiver(OutlinePlugin.this);

  // Receiver to forward VPN service broadcasts to the WebView when the tunnel status changes.
  private static class VpnTunnelBroadcastReceiver extends BroadcastReceiver {
    private final OutlinePlugin outlinePlugin;

    public VpnTunnelBroadcastReceiver(OutlinePlugin outlinePlugin) {
      this.outlinePlugin = outlinePlugin;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
      final String tunnelId = intent.getStringExtra(MessageData.TUNNEL_ID.value);
      if (!outlinePlugin.tunnelStatusListeners.containsKey(tunnelId)) {
        LOG.warning(String.format(
            Locale.ROOT, "Failed to retrieve status listener for tunnel ID %s", tunnelId));
        return;
      }
      int status = intent.getIntExtra(MessageData.PAYLOAD.value, TunnelStatus.INVALID.value);
      LOG.fine(String.format(Locale.ROOT, "VPN connectivity changed: %s, %d", tunnelId, status));

      PluginResult result = new PluginResult(PluginResult.Status.OK, status);
      // Keep the tunnel status callback so it can be called multiple times.
      result.setKeepCallback(true);
      String callbackId = outlinePlugin.tunnelStatusListeners.get(tunnelId);
      outlinePlugin.sendPluginResult(callbackId, result);
    }
  };

  private void sendPluginResult(final String callbackId, int errorCode) {
    PluginResult result;
    if (errorCode == ErrorCode.NO_ERROR.value) {
      result = new PluginResult(PluginResult.Status.OK);
    } else {
      result = new PluginResult(PluginResult.Status.ERROR, errorCode);
    }
    sendPluginResult(callbackId, result);
  }

  private void sendPluginResult(final String callbackId, final PluginResult result) {
    CallbackContext callbackContext = new CallbackContext(callbackId, webView);
    callbackContext.sendPluginResult(result);
  }
}
