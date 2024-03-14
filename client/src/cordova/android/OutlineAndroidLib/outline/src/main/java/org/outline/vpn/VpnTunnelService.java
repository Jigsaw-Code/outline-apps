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
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;
import org.outline.IVpnTunnelService;
import org.outline.TunnelConfig;
import org.outline.log.SentryErrorReporter;
import org.outline.shadowsocks.ShadowsocksConfig;
import shadowsocks.Shadowsocks;

/**
 * Android service responsible for managing a VPN tunnel. Clients must bind to this
 * service in order to access its APIs.
 */
public class VpnTunnelService extends VpnService {
  private static final Logger LOG = Logger.getLogger(VpnTunnelService.class.getName());
  private static final int NOTIFICATION_SERVICE_ID = 1;
  private static final int NOTIFICATION_COLOR = 0x00BFA5;
  private static final String NOTIFICATION_CHANNEL_ID = "outline-vpn";
  private static final String TUNNEL_ID_KEY = "id";
  private static final String TUNNEL_CONFIG_KEY = "config";

  public static final String STATUS_BROADCAST_KEY = "onStatusChange";

  // Plugin error codes. Keep in sync with www/model/errors.ts.
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
    ERROR_REPORTING_API_KEY("errorReportingApiKey");

    public final String value;
    MessageData(final String value) {
      this.value = value;
    }
  }

  private VpnTunnel vpnTunnel;
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
    public boolean isServerReachable(String host, int port) {
      return VpnTunnelService.this.isServerReachable(host, port);
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
        intent.getStringExtra(MessageData.ERROR_REPORTING_API_KEY.value);
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
    broadcastVpnConnectivityChange(TunnelStatus.DISCONNECTED);
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
    // `name` and `prefix` are optional properties.
    try {
      tunnelConfig.name = config.getString("name");
    } catch (JSONException e) {
      LOG.fine("Tunnel config missing name");
    }
    String prefix = null;
    try {
      prefix = config.getString("prefix");
      LOG.fine("Activating experimental prefix support");
    } catch (JSONException e) {
      // pass
    }
    if (prefix != null) {
      tunnelConfig.proxy.prefix = new byte[prefix.length()];
      for (int i = 0; i < prefix.length(); i++) {
        char c = prefix.charAt(i);
        if ((c & 0xFF) != c) {
          throw new JSONException(String.format("Prefix character '%c' is out of range", c));
        }
        tunnelConfig.proxy.prefix[i] = (byte)c;
      }
    }
    return tunnelConfig;
  }

  // Tunnel API

  private ErrorCode startTunnel(final TunnelConfig config) {
    return startTunnel(config, false);
  }

  private synchronized ErrorCode startTunnel(
      final TunnelConfig config, boolean isAutoStart) {
    LOG.info(String.format(Locale.ROOT, "Starting tunnel %s.", config.id));
    if (config.id == null || config.proxy == null) {
      return ErrorCode.ILLEGAL_SERVER_CONFIGURATION;
    }
    final boolean isRestart = tunnelConfig != null;
    if (isRestart) {
      // Broadcast the previous instance disconnect event before reassigning the tunnel config.
      broadcastVpnConnectivityChange(TunnelStatus.DISCONNECTED);
      stopForeground();
      try {
        // Disconnect the tunnel; do not tear down the VPN to avoid leaking traffic.
        vpnTunnel.disconnectTunnel();
      } catch (Exception e) {
        LOG.log(Level.SEVERE, "Failed to disconnect tunnel", e);
      }
    }

    final shadowsocks.Config configCopy = new shadowsocks.Config();
    configCopy.setHost(config.proxy.host);
    configCopy.setPort(config.proxy.port);
    configCopy.setCipherName(config.proxy.method);
    configCopy.setPassword(config.proxy.password);
    configCopy.setPrefix(config.proxy.prefix);
    final shadowsocks.Client client;
    try {
      client = new shadowsocks.Client(configCopy);
    } catch (Exception e) {
      LOG.log(Level.WARNING, "Invalid configuration", e);
      tearDownActiveTunnel();
      return ErrorCode.ILLEGAL_SERVER_CONFIGURATION;
    }

    ErrorCode errorCode = ErrorCode.NO_ERROR;
    if (!isAutoStart) {
      try {
        // Do not perform connectivity checks when connecting on startup. We should avoid failing
        // the connection due to a network error, as network may not be ready.
        errorCode = checkServerConnectivity(client);
        if (!(errorCode == ErrorCode.NO_ERROR
                || errorCode == ErrorCode.UDP_RELAY_NOT_ENABLED)) {
          tearDownActiveTunnel();
          return errorCode;
        }
      } catch (Exception e) {
        tearDownActiveTunnel();
        return ErrorCode.SHADOWSOCKS_START_FAILURE;
      }
    }
    tunnelConfig = config;

    if (!isRestart) {
      // Only establish the VPN if this is not a tunnel restart.
      if (!vpnTunnel.establishVpn()) {
        LOG.severe("Failed to establish the VPN");
        tearDownActiveTunnel();
        return ErrorCode.VPN_START_FAILURE;
      }
      startNetworkConnectivityMonitor();
    }

    final boolean remoteUdpForwardingEnabled =
        isAutoStart ? tunnelStore.isUdpSupported() : errorCode == ErrorCode.NO_ERROR;
    try {
      vpnTunnel.connectTunnel(client, remoteUdpForwardingEnabled);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to connect the tunnel", e);
      tearDownActiveTunnel();
      return ErrorCode.VPN_START_FAILURE;
    }
    startForegroundWithNotification(config);
    storeActiveTunnel(config, remoteUdpForwardingEnabled);
    return ErrorCode.NO_ERROR;
  }

  private synchronized ErrorCode stopTunnel(final String tunnelId) {
    if (!isTunnelActive(tunnelId)) {
      return ErrorCode.UNEXPECTED;
    }
    tearDownActiveTunnel();
    return ErrorCode.NO_ERROR;
  }

  private synchronized boolean isTunnelActive(final String tunnelId) {
    if (tunnelConfig == null || tunnelConfig.id == null) {
      return false;
    }
    return tunnelConfig.id.equals(tunnelId);
  }

  private boolean isServerReachable(final String host, final int port) {
    try {
      Shadowsocks.checkServerReachable(host, port);
    } catch (Exception e) {
      return false;
    }
    return true;
  }

  /* Helper method to tear down an active tunnel. */
  private void tearDownActiveTunnel() {
    stopVpnTunnel();
    stopForeground();
    tunnelConfig = null;
    stopNetworkConnectivityMonitor();
    tunnelStore.setTunnelStatus(TunnelStatus.DISCONNECTED);
  }

  /* Helper method that stops Shadowsocks, tun2socks, and tears down the VPN. */
  private void stopVpnTunnel() {
    vpnTunnel.disconnectTunnel();
    vpnTunnel.tearDownVpn();
  }

  // Shadowsocks

  private ErrorCode checkServerConnectivity(final shadowsocks.Client client) {
    try {
      long errorCode = Shadowsocks.checkConnectivity(client);
      ErrorCode result = ErrorCode.values()[(int) errorCode];
      LOG.info(String.format(Locale.ROOT, "Go connectivity check result: %s", result.name()));
      return result;
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Connectivity checks failed", e);
    }
    return ErrorCode.UNEXPECTED;
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
      broadcastVpnConnectivityChange(TunnelStatus.CONNECTED);
      updateNotification(TunnelStatus.CONNECTED);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // Indicate that traffic will be sent over the current active network.
        // Although setting the underlying network to an available network may not seem like the
        // correct behavior, this method has been observed only to fire only when a preferred
        // network becomes available. It will not fire, for example, when the mobile network becomes
        // available if WiFi is the active network. Additionally, `getActiveNetwork` and
        // `getActiveNetworkInfo` have been observed to return the underlying network set by us.
        setUnderlyingNetworks(new Network[] {network});
      }
      boolean isUdpSupported = vpnTunnel.updateUDPSupport();
      LOG.info(
          String.format("UDP support: %s -> %s", tunnelStore.isUdpSupported(), isUdpSupported));
      tunnelStore.setIsUdpSupported(isUdpSupported);
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
      broadcastVpnConnectivityChange(TunnelStatus.RECONNECTING);
      updateNotification(TunnelStatus.RECONNECTING);

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

  // Broadcasts

  /* Broadcast change in the VPN connectivity. */
  private void broadcastVpnConnectivityChange(TunnelStatus status) {
    if (tunnelConfig == null) {
      LOG.warning("Tunnel disconnected, not sending VPN connectivity broadcast");
      return;
    }
    Intent statusChange = new Intent(STATUS_BROADCAST_KEY);
    statusChange.addCategory(getPackageName());
    statusChange.putExtra(MessageData.PAYLOAD.value, status.value);
    statusChange.putExtra(MessageData.TUNNEL_ID.value, tunnelConfig.id);
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
      startForegroundWithNotification(config);
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

      if (config.proxy.prefix != null) {
        char[] chars = new char[config.proxy.prefix.length];
        for (int i = 0; i < config.proxy.prefix.length; i++) {
          // Unsigned bit width extension requires a mask in Java.
          chars[i] = (char)(config.proxy.prefix[i] & 0xFF);
        }
        proxyConfig.put("prefix", new String(chars));
      }

      tunnel.put(TUNNEL_ID_KEY, config.id).put(TUNNEL_CONFIG_KEY, proxyConfig);
      tunnelStore.save(tunnel);
    } catch (JSONException e) {
      LOG.log(Level.SEVERE, "Failed to store JSON tunnel data", e);
    }
    tunnelStore.setTunnelStatus(TunnelStatus.CONNECTED);
    tunnelStore.setIsUdpSupported(isUdpSupported);
  }

  // Error reporting

  private void initErrorReporting(final String apiKey) {
    try {
      SentryErrorReporter.init(this, apiKey);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to initialize Sentry", e);
    }
  }

  // Foreground service & notifications

  /* Starts the service in the foreground and displays a persistent notification. */
  private void startForegroundWithNotification(final TunnelConfig config) {
    try {
      if (notificationBuilder == null) {
        // Cache the notification builder so we can update the existing notification - creating a
        // new notification has the side effect of resetting the tunnel timer.
        notificationBuilder = getNotificationBuilder(config);
      }
      notificationBuilder.setContentText(getStringResource("connected_server_state"));
      startForeground(NOTIFICATION_SERVICE_ID, notificationBuilder.build());
    } catch (Exception e) {
      LOG.warning("Unable to display persistent notification");
    }
  }

  /* Updates the persistent notification to reflect the tunnel status. */
  private void updateNotification(TunnelStatus status) {
    try {
      if (notificationBuilder == null) {
        return; // No notification to update.
      }
      final String statusStringResourceId = status == TunnelStatus.CONNECTED
          ? "connected_server_state"
          : "reconnecting_server_state";
      notificationBuilder.setContentText(getStringResource(statusStringResourceId));
      NotificationManager notificationManager =
          (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      notificationManager.notify(NOTIFICATION_SERVICE_ID, notificationBuilder.build());
    } catch (Exception e) {
      LOG.warning("Failed to update persistent notification");
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
