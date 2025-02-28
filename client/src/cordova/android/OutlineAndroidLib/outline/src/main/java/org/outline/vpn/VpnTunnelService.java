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
import android.content.pm.ServiceInfo;
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
import org.outline.DetailedJsonError;
import org.outline.log.SentryErrorReporter;
import outline.NewClientResult;
import outline.Outline;
import outline.TCPAndUDPConnectivityResult;
import platerrors.Platerrors;
import platerrors.PlatformError;

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
  private static final String TUNNEL_SERVER_NAME = "serverName";

  public static final String STATUS_BROADCAST_KEY = "onStatusChange";

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
    public DetailedJsonError startTunnel(TunnelConfig config) {
      return VpnTunnelService.this.startTunnel(config);
    }

    @Override
    public DetailedJsonError stopTunnel(String tunnelId) {
      return VpnTunnelService.this.stopTunnel(tunnelId);
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

  // Tunnel API

  private DetailedJsonError startTunnel(final TunnelConfig config) {
    return Errors.toDetailedJsonError(startTunnel(config, false));
  }

  private synchronized PlatformError startTunnel(
      final TunnelConfig config, boolean isAutoStart) {
    LOG.info(String.format(Locale.ROOT, "Starting tunnel %s for server %s", config.id, config.name));
    if (config.id == null || config.transportConfig == null) {
      return new PlatformError(Platerrors.InvalidConfig, "id and transportConfig are required");
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

    final NewClientResult clientResult = Outline.newClient(config.transportConfig);
    if (clientResult.getError() != null) {
      LOG.log(Level.WARNING, "Failed to create Outline Client", clientResult.getError());
      tearDownActiveTunnel();
      return clientResult.getError();
    }
    final outline.Client client = clientResult.getClient();

    PlatformError udpConnError = null;
    if (!isAutoStart) {
      try {
        // Do not perform connectivity checks when connecting on startup. We should avoid failing
        // the connection due to a network error, as network may not be ready.
        final TCPAndUDPConnectivityResult connResult = checkServerConnectivity(client);
        if (connResult.getTCPError() != null) {
          tearDownActiveTunnel();
          return connResult.getTCPError();
        }
        udpConnError = connResult.getUDPError();
      } catch (Exception e) {
        tearDownActiveTunnel();
        return new PlatformError(Platerrors.InternalError, "failed to check connectivity");
      }
    }
    tunnelConfig = config;

    if (!isRestart) {
      // Only establish the VPN if this is not a tunnel restart.
      if (!vpnTunnel.establishVpn()) {
        LOG.severe("Failed to establish the VPN");
        tearDownActiveTunnel();
        return new PlatformError(Platerrors.SetupSystemVPNFailed, "failed to establish the VPN");
      }
      startNetworkConnectivityMonitor();
    }

    final boolean remoteUdpForwardingEnabled =
        isAutoStart ? tunnelStore.isUdpSupported() : udpConnError == null;
    try {
      final PlatformError tunError = vpnTunnel.connectTunnel(client, remoteUdpForwardingEnabled);
      if (tunError != null) {
        LOG.log(Level.SEVERE, "Failed to connect the tunnel", tunError);
        tearDownActiveTunnel();
        return tunError;
      }
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to connect the tunnel", e);
      tearDownActiveTunnel();
      return new PlatformError(Platerrors.SetupTrafficHandlerFailed,
          "failed to connect the tunnel");
    }
    startForegroundWithNotification(config.name);
    storeActiveTunnel(config, remoteUdpForwardingEnabled);
    return null;
  }

  private synchronized DetailedJsonError stopTunnel(final String tunnelId) {
    if (!isTunnelActive(tunnelId)) {
      return Errors.toDetailedJsonError(new PlatformError(
          Platerrors.InternalError,
          "VPN profile is not active"));
    }
    tearDownActiveTunnel();
    return null;
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
    tunnelStore.setTunnelStatus(TunnelStatus.DISCONNECTED);
  }

  /* Helper method that stops the Outline client, tun2socks, and tears down the VPN. */
  private void stopVpnTunnel() {
    vpnTunnel.disconnectTunnel();
    vpnTunnel.tearDownVpn();
  }

  // Connectivity

  private TCPAndUDPConnectivityResult checkServerConnectivity(final outline.Client client) {
    final TCPAndUDPConnectivityResult result = Outline.checkTCPAndUDPConnectivity(client);
    LOG.info(String.format(Locale.ROOT, "Go connectivity check result: %s", result));
    return result;
  }

  private class NetworkConnectivityMonitor extends ConnectivityManager.NetworkCallback {
    private final ConnectivityManager connectivityManager;

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
    // We must explicitly set the package for security reasons: https://developer.android.com/about/versions/14/behavior-changes-14#security
    statusChange.setPackage(this.getPackageName());
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
      final TunnelConfig tunnelConfig = new TunnelConfig();
      tunnelConfig.id = tunnel.getString(TUNNEL_ID_KEY);
      tunnelConfig.name = tunnel.getString(TUNNEL_SERVER_NAME);
      tunnelConfig.transportConfig = tunnel.getString(TUNNEL_CONFIG_KEY);

      // Start the service in the foreground as per Android 8+ background service execution limits.
      // Requires android.permission.FOREGROUND_SERVICE since Android P.
      startForegroundWithNotification(tunnelConfig.name);
      startTunnel(tunnelConfig, true);
    } catch (Exception e) {
      LOG.log(Level.SEVERE, "Failed to retrieve JSON tunnel data", e);
    }
  }

  private void storeActiveTunnel(final TunnelConfig config, boolean isUdpSupported) {
    LOG.info("Storing active tunnel.");
    JSONObject tunnel = new JSONObject();
    try {
      tunnel.put(TUNNEL_ID_KEY, config.id).put(
        TUNNEL_CONFIG_KEY, config.transportConfig).put(TUNNEL_SERVER_NAME, config.name);
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
  private void startForegroundWithNotification(final String serverName) {
    try {
      if (notificationBuilder == null) {
        // Cache the notification builder so we can update the existing notification - creating a
        // new notification has the side effect of resetting the tunnel timer.
        notificationBuilder = getNotificationBuilder(serverName);
      }
      notificationBuilder.setContentText(getStringResource("connected_server_state"));

      // We must specify the service type for security reasons: https://developer.android.com/about/versions/14/changes/fgs-types-required
      startForeground(NOTIFICATION_SERVICE_ID, notificationBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
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

  /* Returns a notification builder with the provided server name.  */
  private Notification.Builder getNotificationBuilder(final String serverName) throws Exception {
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
    return builder.setContentTitle(serverName)
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
