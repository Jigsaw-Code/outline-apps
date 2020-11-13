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

package org.outline.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.NetworkRequest;
import android.net.VpnService;
import android.os.Build;
import android.os.IBinder;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;
import org.outline.IVpnTunnelService;
import org.outline.OutlinePlugin;
import org.outline.TunnelConfig;
import org.outline.log.SentryErrorReporter;
import org.outline.shadowsocks.Shadowsocks;
import org.outline.shadowsocks.ShadowsocksConfig;
import org.outline.shadowsocks.ShadowsocksConnectivity;

/**
 * Android service responsible for managing a VPN tunnel. Clients must bind to this
 * service in order to access its APIs.
 */
public class VpnTunnelService extends VpnService {
  private static final Logger LOG = Logger.getLogger(VpnTunnelService.class.getName());
  private static final int THREAD_POOL_SIZE = 5;
  private static final int NOTIFICATION_SERVICE_ID = 1;
  private static final int NOTIFICATION_COLOR = 0x00BFA5;
  private static final String NOTIFICATION_CHANNEL_ID = "outline-vpn";
  private static final String TUNNEL_ID_KEY = "id";
  private static final String TUNNEL_CONFIG_KEY = "config";

  private ThreadPoolExecutor executorService;
  private VpnTunnel vpnTunnel;
  private Shadowsocks shadowsocks;
  private TunnelConfig tunnelConfig;
  private NetworkConnectivityMonitor networkConnectivityMonitor;
  private VpnTunnelStore tunnelStore;
  private Notification.Builder notificationBuilder;

  private final IVpnTunnelService.Stub binder = new IVpnTunnelService.Stub() {
    @Override
    public int startTunnel(TunnelConfig config) {
      return VpnTunnelService.this.startTunnel(config).value;
    }

    @Override
    public int stopTunnel(String tunnelId) {
      return VpnTunnelService.this.stopTunnel(tunnelId).value;
    }

    @Override
    public boolean isTunnelActive(String tunnelId) {
      return VpnTunnelService.this.isTunnelActive(tunnelId);
    }

    @Override
    public void initErrorReporting(String apiKey) {
      VpnTunnelService.this.initErrorReporting(apiKey);
    }
  };

  @Override
  public void onCreate() {
    LOG.info("Creating VPN service.");
    vpnTunnel = new VpnTunnel(this);
    shadowsocks = new Shadowsocks(this);
    executorService = (ThreadPoolExecutor) Executors.newFixedThreadPool(THREAD_POOL_SIZE);
    networkConnectivityMonitor = new NetworkConnectivityMonitor();
    tunnelStore = new VpnTunnelStore(VpnTunnelService.this);
  }

  @Override
  public IBinder onBind(Intent intent) {
    LOG.info(String.format(Locale.ROOT, "Binding VPN service: %s", intent));
    String action = intent.getAction();
    if (action != null && action.equals(SERVICE_INTERFACE)) {
      return super.onBind(intent);
    }
    if (intent.getBooleanExtra(VpnServiceStarter.AUTOSTART_EXTRA, false)) {
      startLastSuccessfulTunnel();
    }
    String errorReportingApiKey =
        intent.getStringExtra(OutlinePlugin.MessageData.ERROR_REPORTING_API_KEY.value);
    if (errorReportingApiKey != null) {
      initErrorReporting(errorReportingApiKey);
    }
    return binder;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    LOG.info(String.format(Locale.ROOT, "Starting VPN service: %s", intent));
    int superOnStartReturnValue = super.onStartCommand(intent, flags, startId);
    if (intent != null) {
      // VpnServiceStarter puts AUTOSTART_EXTRA in the intent when the service starts automatically.
      boolean startedByVpnStarter =
          intent.getBooleanExtra(VpnServiceStarter.AUTOSTART_EXTRA, false);
      boolean startedByAlwaysOn = VpnService.SERVICE_INTERFACE.equals(intent.getAction());
      if (startedByVpnStarter || startedByAlwaysOn) {
        startLastSuccessfulTunnel();
      }
    }
    return superOnStartReturnValue;
  }

  @Override
  public void onRevoke() {
    LOG.info("VPN revoked.");
    broadcastVpnConnectivityChange(OutlinePlugin.TunnelStatus.DISCONNECTED);
    tearDownActiveTunnel();
  }

  @Override
  public void onDestroy() {
    LOG.info("Destroying VPN service.");
    tearDownActiveTunnel();
  }

  public VpnService.Builder newBuilder() {
    return new VpnService.Builder();
  }

  /**
   * Helper method to build a TunnelConfig from a JSON object.
   *
   * @param tunnelId unique identifier for the tunnel.
   * @param config JSON object containing TunnelConfig values.
   * @throws IllegalArgumentException if `tunnelId` or `config` are null.
   * @throws JSONException if parsing `config` fails.
   * @return populated TunnelConfig
   */
  public static TunnelConfig makeTunnelConfig(final String tunnelId, final JSONObject config)
      throws Exception {
    if (tunnelId == null || config == null) {
      throw new IllegalArgumentException("Must provide a tunnel ID and JSON configuration");
    }
    final TunnelConfig tunnelConfig = new TunnelConfig();
    tunnelConfig.id = tunnelId;
    tunnelConfig.proxy = new ShadowsocksConfig();
    tunnelConfig.proxy.host = config.getString("host");
    tunnelConfig.proxy.port = config.getInt("port");
    tunnelConfig.proxy.password = config.getString("password");
    tunnelConfig.proxy.method = config.getString("method");
    try {
      // `name` is an optional property; don't throw if it fails to parse.
      tunnelConfig.name = config.getString("name");
    } catch (JSONException e) {
      LOG.fine("Tunnel config missing name");
    }
    return tunnelConfig;
  }

  // Tunnel API

  private OutlinePlugin.ErrorCode startTunnel(final TunnelConfig config) {
    return startTunnel(config, false);
  }

  private synchronized OutlinePlugin.ErrorCode startTunnel(
      final TunnelConfig config, boolean isAutoStart) {
    LOG.info(String.format(Locale.ROOT, "Starting tunnel %s.", config.id));
    if (config.id == null || config.proxy == null) {
      return OutlinePlugin.ErrorCode.ILLEGAL_SERVER_CONFIGURATION;
    }
    final boolean isRestart = tunnelConfig != null;
    if (isRestart) {
      // Broadcast the previous instance disconnect event before reassigning the tunnel ID.
      broadcastVpnConnectivityChange(OutlinePlugin.TunnelStatus.DISCONNECTED);
      stopForeground();
    }
    tunnelConfig = config;

    OutlinePlugin.ErrorCode errorCode = OutlinePlugin.ErrorCode.NO_ERROR;
    try {
      // Do not perform connectivity checks when connecting on startup. We should avoid failing
      // the tunnel due to a network error, as network may not be ready.
      errorCode = startShadowsocks(config.proxy, !isAutoStart).get();
      if (!(errorCode == OutlinePlugin.ErrorCode.NO_ERROR
              || errorCode == OutlinePlugin.ErrorCode.UDP_RELAY_NOT_ENABLED)) {
        tearDownActiveTunnel();
        return errorCode;
      }
    } catch (Exception e) {
      tearDownActiveTunnel();
      return OutlinePlugin.ErrorCode.SHADOWSOCKS_START_FAILURE;
    }

    if (isRestart) {
      vpnTunnel.disconnectTunnel();
    } else {
      // Only establish the VPN if this is not a tunnel restart.
      if (!vpnTunnel.establishVpn()) {
        LOG.severe("Failed to establish the VPN");
        tearDownActiveTunnel();
        return OutlinePlugin.ErrorCode.VPN_START_FAILURE;
      }
      startNetworkConnectivityMonitor();
    }

    final boolean remoteUdpForwardingEnabled =
        isAutoStart ? tunnelStore.isUdpSupported() : errorCode == OutlinePlugin.ErrorCode.NO_ERROR;
    try {
      vpnTunnel.connectTunnel(shadowsocks.getLocalServerAddress(), remoteUdpForwardingEnabled);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to connect the tunnel", e);
      tearDownActiveTunnel();
      return OutlinePlugin.ErrorCode.VPN_START_FAILURE;
    }
    startForegroundWithNotification(config, OutlinePlugin.TunnelStatus.CONNECTED);
    storeActiveTunnel(config, remoteUdpForwardingEnabled);
    return OutlinePlugin.ErrorCode.NO_ERROR;
  }

  private synchronized OutlinePlugin.ErrorCode stopTunnel(final String tunnelId) {
    if (!isTunnelActive(tunnelId)) {
      return OutlinePlugin.ErrorCode.UNEXPECTED;
    }
    tearDownActiveTunnel();
    return OutlinePlugin.ErrorCode.NO_ERROR;
  }

  private synchronized boolean isTunnelActive(final String tunnelId) {
    if (tunnelConfig == null || tunnelConfig.id == null) {
      return false;
    }
    return tunnelConfig.id.equals(tunnelId);
  }

  /* Helper method to tear down an active tunnel. */
  private void tearDownActiveTunnel() {
    stopVpnTunnel();
    stopForeground();
    tunnelConfig = null;
    stopNetworkConnectivityMonitor();
    tunnelStore.setTunnelStatus(OutlinePlugin.TunnelStatus.DISCONNECTED);
  }

  /* Helper method that stops Shadowsocks, tun2socks, and tears down the VPN. */
  private void stopVpnTunnel() {
    shadowsocks.stop();
    vpnTunnel.disconnectTunnel();
    vpnTunnel.tearDownVpn();
  }

  // Shadowsocks

  /* Starts a local Shadowsocks server and performs connectivity tests if
   * |performConnectivityChecks| is true, to ensure compatibility. Returns a Future encapsulating an
   * error code, as defined in OutlinePlugin.ErrorCode. */
  private Future<OutlinePlugin.ErrorCode> startShadowsocks(
      final ShadowsocksConfig config, final boolean performConnectivityChecks) {
    return executorService.submit(() -> {
      // No need to stop explicitly; shadowsocks.start will stop any running instances.
      if (!shadowsocks.start(config)) {
        LOG.severe("Failed to start Shadowsocks.");
        return OutlinePlugin.ErrorCode.SHADOWSOCKS_START_FAILURE;
      }
      if (performConnectivityChecks) {
        return checkServerConnectivity(Shadowsocks.LOCAL_SERVER_ADDRESS,
            Integer.parseInt(Shadowsocks.LOCAL_SERVER_PORT), config.host, config.port);
      }
      return OutlinePlugin.ErrorCode.NO_ERROR;
    });
  }

  /* Checks that the remote server is reachable, allows UDP forwarding, and the credentials are
   * valid. Executes the three checks in parallel in order to minimize the user's wait time. */
  private OutlinePlugin.ErrorCode checkServerConnectivity(
      final String localServerAddress,
      final int localServerPort,
      final String remoteServerAddress,
      final int remoteServerPort) {
    final Callable<Boolean> udpForwardingCheck =
        new Callable<Boolean>() {
          public Boolean call() {
            return ShadowsocksConnectivity.isUdpForwardingEnabled(
                localServerAddress, localServerPort);
          }
        };
    final Callable<Boolean> reachabilityCheck =
        new Callable<Boolean>() {
          public Boolean call() {
            return ShadowsocksConnectivity.isServerReachable(remoteServerAddress, remoteServerPort);
          }
        };
    final Callable<Boolean> credentialsValidationCheck =
        new Callable<Boolean>() {
          public Boolean call() {
            return ShadowsocksConnectivity.validateServerCredentials(
                localServerAddress, localServerPort);
          }
        };
    try {
      Future<Boolean> udpCheckResult = executorService.submit(udpForwardingCheck);
      Future<Boolean> reachabilityCheckResult = executorService.submit(reachabilityCheck);
      Future<Boolean> credentialsCheckResult = executorService.submit(credentialsValidationCheck);
      boolean isUdpForwardingEnabled = udpCheckResult.get();
      if (isUdpForwardingEnabled) {
        // The UDP forwarding check is a superset of the TCP checks. Don't wait for the other tests
        // to complete; if they fail, assume it's due to intermittent network conditions and declare
        // success anyway.
        return OutlinePlugin.ErrorCode.NO_ERROR;
      } else {
        boolean isReachable = reachabilityCheckResult.get();
        boolean credentialsAreValid = credentialsCheckResult.get();
        LOG.info(String.format(Locale.ROOT,
            "Server connectivity: UDP forwarding disabled, server %s, creds. %s",
            isReachable ? "reachable" : "unreachable", credentialsAreValid ? "valid" : "invalid"));
        if (credentialsAreValid) {
          return OutlinePlugin.ErrorCode.UDP_RELAY_NOT_ENABLED;
        } else if (isReachable) {
          return OutlinePlugin.ErrorCode.INVALID_SERVER_CREDENTIALS;
        }
      }
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to execute server connectivity tests", e);
    }
    // Be conservative in declaring UDP forwarding or credentials failure.
    return OutlinePlugin.ErrorCode.SERVER_UNREACHABLE;
  }

  // Connectivity

  private class NetworkConnectivityMonitor extends ConnectivityManager.NetworkCallback {
    private ConnectivityManager connectivityManager;

    public NetworkConnectivityMonitor() {
      this.connectivityManager =
          (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    @Override
    public void onAvailable(Network network) {
      NetworkInfo networkInfo = connectivityManager.getNetworkInfo(network);
      LOG.fine(String.format(Locale.ROOT, "Network available: %s", networkInfo));
      if (networkInfo == null || networkInfo.getState() != NetworkInfo.State.CONNECTED) {
        return;
      }
      broadcastVpnConnectivityChange(OutlinePlugin.TunnelStatus.CONNECTED);
      startForegroundWithNotification(tunnelConfig, OutlinePlugin.TunnelStatus.CONNECTED);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // Indicate that traffic will be sent over the current active network.
        // Although setting the underlying network to an available network may not seem like the
        // correct behavior, this method has been observed only to fire only when a preferred
        // network becomes available. It will not fire, for example, when the mobile network becomes
        // available if WiFi is the active network. Additionally, `getActiveNetwork` and
        // `getActiveNetworkInfo` have been observed to return the underlying network set by us.
        setUnderlyingNetworks(new Network[] {network});
      }

      final boolean wasUdpSupported = tunnelStore.isUdpSupported();
      final boolean isUdpSupported = ShadowsocksConnectivity.isUdpForwardingEnabled(
          Shadowsocks.LOCAL_SERVER_ADDRESS, Integer.parseInt(Shadowsocks.LOCAL_SERVER_PORT));
      tunnelStore.setIsUdpSupported(isUdpSupported);
      LOG.info(String.format("UDP support: %s -> %s", wasUdpSupported, isUdpSupported));
      if (isUdpSupported != wasUdpSupported) {
        // UDP forwarding support changed with the network; restart the tunnel.
        startTunnel(tunnelConfig);
      }
    }

    @Override
    public void onLost(Network network) {
      LOG.fine(String.format(
          Locale.ROOT, "Network lost: %s", connectivityManager.getNetworkInfo(network)));
      NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
      if (activeNetworkInfo != null
          && activeNetworkInfo.getState() == NetworkInfo.State.CONNECTED) {
        return;
      }
      broadcastVpnConnectivityChange(OutlinePlugin.TunnelStatus.RECONNECTING);
      startForegroundWithNotification(tunnelConfig, OutlinePlugin.TunnelStatus.RECONNECTING);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        setUnderlyingNetworks(null);
      }
    }
  }

  private void startNetworkConnectivityMonitor() {
    final ConnectivityManager connectivityManager =
        (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkRequest request = new NetworkRequest.Builder()
                                 .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                                 .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)
                                 .build();
    // `registerNetworkCallback` returns the VPN interface as the default network since Android P.
    // Use `requestNetwork` instead (requires android.permission.CHANGE_NETWORK_STATE).
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      connectivityManager.registerNetworkCallback(request, networkConnectivityMonitor);
    } else {
      connectivityManager.requestNetwork(request, networkConnectivityMonitor);
    }
  }

  private void stopNetworkConnectivityMonitor() {
    final ConnectivityManager connectivityManager =
        (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    try {
      connectivityManager.unregisterNetworkCallback(networkConnectivityMonitor);
    } catch (Exception e) {
      // Ignore, monitor not installed if the connectivity checks failed.
    }
  }

  /* Broadcast change in the VPN connectivity. */
  private void broadcastVpnConnectivityChange(OutlinePlugin.TunnelStatus status) {
    Intent statusChange = new Intent(OutlinePlugin.Action.ON_STATUS_CHANGE.value);
    statusChange.addCategory(getPackageName());
    statusChange.putExtra(OutlinePlugin.MessageData.PAYLOAD.value, status.value);
    statusChange.putExtra(OutlinePlugin.MessageData.TUNNEL_ID.value, tunnelConfig.id);
    sendBroadcast(statusChange);
  }

  // Autostart

  private void startLastSuccessfulTunnel() {
    LOG.info("Received an auto-connect request, loading last successful tunnel.");
    JSONObject tunnel = tunnelStore.load();
    if (tunnel == null) {
      LOG.info("Last successful tunnel not found. User not connected at shutdown/install.");
      return;
    }
    if (VpnTunnelService.prepare(VpnTunnelService.this) != null) {
      // We cannot prepare the VPN when running as a background service, as it requires UI.
      LOG.warning("VPN not prepared, aborting auto-connect.");
      return;
    }
    try {
      final String tunnelId = tunnel.getString(TUNNEL_ID_KEY);
      final JSONObject jsonConfig = tunnel.getJSONObject(TUNNEL_CONFIG_KEY);
      final TunnelConfig config = makeTunnelConfig(tunnelId, jsonConfig);
      // Start the service in the foreground as per Android 8+ background service execution limits.
      // Requires android.permission.FOREGROUND_SERVICE since Android P.
      startForegroundWithNotification(config, OutlinePlugin.TunnelStatus.RECONNECTING);
      startTunnel(config, true);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to retrieve JSON tunnel data", e);
    }
  }

  private void storeActiveTunnel(final TunnelConfig config, boolean isUdpSupported) {
    LOG.info("Storing active tunnel.");
    JSONObject tunnel = new JSONObject();
    try {
      JSONObject proxyConfig = new JSONObject();
      proxyConfig.put("host", config.proxy.host);
      proxyConfig.put("port", config.proxy.port);
      proxyConfig.put("password", config.proxy.password);
      proxyConfig.put("method", config.proxy.method);
      tunnel.put(TUNNEL_ID_KEY, config.id).put(TUNNEL_CONFIG_KEY, proxyConfig);
      tunnelStore.save(tunnel);
    } catch (JSONException e) {
      LOG.log(Level.SEVERE, "Failed to store JSON tunnel data", e);
    }
    tunnelStore.setTunnelStatus(OutlinePlugin.TunnelStatus.CONNECTED);
    tunnelStore.setIsUdpSupported(isUdpSupported);
  }

  // Error reporting

  private void initErrorReporting(final String apiKey) {
    try {
      SentryErrorReporter.init(getApplicationContext(), apiKey);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to initialize Sentry", e);
    }
  }

  // Foreground service & notifications

  /* Starts the service in the foreground and  displays a persistent notification. */
  private void startForegroundWithNotification(
      final TunnelConfig config, OutlinePlugin.TunnelStatus status) {
    try {
      if (notificationBuilder == null) {
        // Cache the notification builder so we can update the existing notification - creating a
        // new notification has the side effect of resetting the tunnel timer.
        notificationBuilder = getNotificationBuilder(config);
      }
      final String statusStringResourceId = status == OutlinePlugin.TunnelStatus.CONNECTED
          ? "connected_server_state"
          : "reconnecting_server_state";
      notificationBuilder.setContentText(getStringResource(statusStringResourceId));
      startForeground(NOTIFICATION_SERVICE_ID, notificationBuilder.build());
    } catch (Exception e) {
      LOG.warning("Unable to display persistent notification");
    }
  }

  /* Returns a notification builder with the provided server configuration.  */
  private Notification.Builder getNotificationBuilder(final TunnelConfig config) throws Exception {
    Intent launchIntent = new Intent(this, getPackageMainActivityClass());
    PendingIntent mainActivityIntent =
        PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT);

    Notification.Builder builder;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
          NOTIFICATION_CHANNEL_ID, "Outline", NotificationManager.IMPORTANCE_LOW);
      NotificationManager notificationManager = getSystemService(NotificationManager.class);
      notificationManager.createNotificationChannel(channel);
      builder = new Notification.Builder(this, NOTIFICATION_CHANNEL_ID);
    } else {
      builder = new Notification.Builder(this);
    }
    try {
      builder.setSmallIcon(getResourceId("small_icon", "drawable"));
    } catch (Exception e) {
      LOG.warning("Failed to retrieve the resource ID for the notification icon.");
    }
    return builder.setContentTitle(getServerName(config))
        .setColor(NOTIFICATION_COLOR)
        .setVisibility(Notification.VISIBILITY_SECRET) // Don't display in lock screen
        .setContentIntent(mainActivityIntent)
        .setShowWhen(true)
        .setUsesChronometer(true);
  }

  /* Stops the foreground service and removes the persistent notification. */
  private void stopForeground() {
    stopForeground(true /* remove notification */);
    notificationBuilder = null;
  }

  /* Retrieves the MainActivity class from the application package. */
  private Class<?> getPackageMainActivityClass() throws Exception {
    try {
      return Class.forName(getPackageName() + ".MainActivity");
    } catch (Exception e) {
      LOG.warning("Failed to find MainActivity class for package");
      throw e;
    }
  }

  /* Retrieves the ID for a resource. This is equivalent to using the generated R class. */
  public int getResourceId(final String name, final String type) {
    return getResources().getIdentifier(name, type, getPackageName());
  }

  /* Returns the server's name from |serverConfig|. If the name is not present, it falls back to the
   * host name (IP address), or the application name if neither can be retrieved. */
  private String getServerName(final TunnelConfig config) {
    try {
      String serverName = config.name;
      if (serverName == null || serverName.equals("")) {
        serverName = config.proxy.host;
      }
      return serverName;
    } catch (Exception e) {
      LOG.severe("Failed to get name property from server config.");
    }
    return getStringResource("server_default_name_outline");
  }

  /* Returns the application name. */
  public final String getApplicationName() throws PackageManager.NameNotFoundException {
    PackageManager packageManager = getApplicationContext().getPackageManager();
    ApplicationInfo appInfo = packageManager.getApplicationInfo(getPackageName(), 0);
    return (String) packageManager.getApplicationLabel(appInfo);
  }

  /* Retrieves a localized string by id from the application's resources. */
  private String getStringResource(final String name) {
    String resource = "";
    try {
      resource = getString(getResourceId(name, "string"));
    } catch (Exception e) {
      LOG.warning(String.format(Locale.ROOT, "Failed to retrieve string resource: %s", name));
    }
    return resource;
  }
}
