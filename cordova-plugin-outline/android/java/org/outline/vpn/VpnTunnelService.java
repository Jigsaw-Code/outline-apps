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
import android.content.res.Resources;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkInfo;
import android.net.NetworkRequest;
import android.net.VpnService;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.content.LocalBroadcastManager;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;
import org.outline.OutlinePlugin;
import org.outline.shadowsocks.Shadowsocks;
import org.outline.shadowsocks.ShadowsocksConnectivity;

/**
 * Android background service responsible for managing VPN connections. Clients must bind to this
 * service in order to access its APIs.
 */
public class VpnTunnelService extends VpnService {
  private static final Logger LOG = Logger.getLogger(VpnTunnelService.class.getName());
  private static final int THREAD_POOL_SIZE = 5;
  private static final int NOTIFICATION_SERVICE_ID = 1;
  private static final int NOTIFICATION_COLOR = 0x00BFA5;
  private static final String NOTIFICATION_CHANNEL_ID = "outline-vpn";
  private static final String CONNECTION_ID_KEY = "id";
  private static final String CONNECTION_CONFIG_KEY = "config";

  private final IBinder binder = new LocalBinder();
  private ThreadPoolExecutor executorService;
  private VpnTunnel vpnTunnel;
  private Shadowsocks shadowsocks;
  private String activeConnectionId = null;
  private NetworkConnectivityMonitor networkConnectivityMonitor;
  private VpnConnectionStore connectionStore;
  private Notification.Builder notificationBuilder;

  public class LocalBinder extends Binder {
    public VpnTunnelService getService() {
      return VpnTunnelService.this;
    }
  }

  @Override
  public void onCreate() {
    LOG.info("Creating VPN service.");
    vpnTunnel = new VpnTunnel(this);
    shadowsocks = new Shadowsocks(this);
    executorService = (ThreadPoolExecutor) Executors.newFixedThreadPool(THREAD_POOL_SIZE);
    networkConnectivityMonitor = new NetworkConnectivityMonitor();
    connectionStore = new VpnConnectionStore(VpnTunnelService.this);
  }

  @Override
  public IBinder onBind(Intent intent) {
    String action = intent.getAction();
    if (action != null && action.equals(SERVICE_INTERFACE)) {
      return super.onBind(intent);
    }
    return binder;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    LOG.info(String.format(Locale.ROOT, "Starting VPN service: %s", intent));
    int superOnStartReturnValue = super.onStartCommand(intent, flags, startId);
    if (intent != null) {
      // VpnServiceStarter includes AUTOSTART_EXTRA in the intent if automatic start has occurred.
      boolean startedByVpnStarter =
          intent.getBooleanExtra(VpnServiceStarter.AUTOSTART_EXTRA, false);
      boolean startedByAlwaysOn = VpnService.SERVICE_INTERFACE.equals(intent.getAction());
      if (startedByVpnStarter || startedByAlwaysOn) {
        startLastSuccessfulConnectionOrExit();
      }
    }
    return superOnStartReturnValue;
  }

  @Override
  public void onRevoke() {
    LOG.info("VPN revoked.");
    broadcastVpnConnectivityChange(OutlinePlugin.ConnectionStatus.DISCONNECTED);
    tearDownActiveConnection();
  }

  @Override
  public void onDestroy() {
    LOG.info("Destroying VPN service.");
    tearDownActiveConnection();
  }

  public VpnService.Builder newBuilder() {
    return new VpnService.Builder();
  }

  // Connection API

  /**
   * Establishes a system-wide VPN connected to a remote Shadowsocks server. All device traffic is
   * routed as follows: |VPN TUN interface| <-> |tun2socks| <-> |local Shadowsocks server| <->
   * |remote Shadowsocks server|.
   *
   * <p>This method can be called multiple times with different configurations. The VPN will not be
   * teared down. Broadcasts an intent with action OutlinePlugin.Action.START and an error code extra
   * with the result of the operation, as defined in OutlinePlugin.ErrorCode. Displays a persistent
   * notification for the duration of the connection.
   *
   * @param connectionId unique identifier for the connection.
   * @param config Shadowsocks configuration parameters.
   * @throws IllegalArgumentException if |connectionId| or |config| are missing.
   */
  public void startConnection(final String connectionId, final JSONObject config) {
    startConnection(connectionId, config, true);
  }

  private void startConnection(
      final String connectionId, final JSONObject config, boolean performConnectivityChecks) {
    LOG.info(String.format(Locale.ROOT, "Starting connection %s.", connectionId));
    boolean isRestart = false;
    if (connectionId == null || config == null) {
      throw new IllegalArgumentException("Must provide a connection ID and configuration.");
    } else if (connectionId.equals(activeConnectionId)) {
      LOG.info(
          String.format(Locale.ROOT, "Already running tunnel for connection ID %s", connectionId));
      broadcastVpnStart(OutlinePlugin.ErrorCode.NO_ERROR); // Start is idempotent.
      return;
    } else if (activeConnectionId != null) {
      // Broadcast the previous instance disconnect event before reassigning the connection ID.
      broadcastVpnConnectivityChange(OutlinePlugin.ConnectionStatus.DISCONNECTED);
      isRestart = true;
    }
    activeConnectionId = connectionId;
    try {
      OutlinePlugin.ErrorCode errorCode = startShadowsocks(config, performConnectivityChecks).get();
      if (errorCode != OutlinePlugin.ErrorCode.NO_ERROR) {
        onVpnStartFailure(errorCode);
        return;
      }
    } catch (Exception e) {
      onVpnStartFailure(OutlinePlugin.ErrorCode.SHADOWSOCKS_START_FAILURE);
      return;
    }

    if (!isRestart) {
      // Only establish the VPN and connect the tunnel if this is not a connection restart.
      if (!vpnTunnel.establishVpn()) {
        LOG.severe("Failed to establish the VPN");
        onVpnStartFailure(OutlinePlugin.ErrorCode.VPN_START_FAILURE);
        return;
      }
      try {
        vpnTunnel.connectTunnel(shadowsocks.getLocalServerAddress());
      } catch (Exception e) {
        LOG.log(Level.SEVERE, "Failed to connect the tunnel", e);
        onVpnStartFailure(OutlinePlugin.ErrorCode.VPN_START_FAILURE);
        return;
      }
      startNetworkConnectivityMonitor();
    } else {
      stopForeground();
    }
    broadcastVpnStart(OutlinePlugin.ErrorCode.NO_ERROR);
    startForegroundWithNotification(config, OutlinePlugin.ConnectionStatus.CONNECTED);
    storeActiveConnection(config);
  }

  /**
   * Tears down a connection started by calling |startConnection|. Stops tun2socks, shadowsocks, and
   * the system-wide VPN.
   *
   * @param connectionId unique identifier for the connection.
   * @throws IllegalArgumentException if |connectionId| is missing.
   * @throws IllegalStateException if the connection represented by |connectionId| is not active.
   */
  public void stopConnection(final String connectionId) {
    if (connectionId == null) {
      throw new IllegalArgumentException("Must provide a connection ID.");
    } else if (!connectionId.equals(activeConnectionId)) {
      throw new IllegalStateException(
          String.format(Locale.ROOT, "Connection %s not active.", connectionId));
    }
    broadcastVpnStop();
    tearDownActiveConnection();
  }

  /**
   * Determines whether a connection is active.
   *
   * @param connectionId unique identifier for the connection.
   * @throws IllegalArgumentException if |connectionId| is missing.
   * @return boolean indicating whether the connection is active.
   */
  public boolean isConnectionActive(final String connectionId) {
    if (connectionId == null) {
      throw new IllegalArgumentException("Must provide a connection ID.");
    }
    return connectionId.equals(activeConnectionId);
  }

  /* Helper method to broadcast a VPN start the failure and reset the service state. */
  private void onVpnStartFailure(OutlinePlugin.ErrorCode errorCode) {
    broadcastVpnStart(errorCode);
    tearDownActiveConnection();
  }

  /* Helper method to tear down an active connection. */
  private void tearDownActiveConnection() {
    stopVpnTunnel();
    stopForeground();
    activeConnectionId = null;
    stopNetworkConnectivityMonitor();
    connectionStore.setConnectionStatus(OutlinePlugin.ConnectionStatus.DISCONNECTED);
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
      final JSONObject config, final boolean performConnectivityChecks) {
    return executorService.submit(
        new Callable<OutlinePlugin.ErrorCode>() {
          public OutlinePlugin.ErrorCode call() {
            try {
              // No need to stop explicitly; shadowsocks.start will stop any running instances.
              if (!shadowsocks.start(config)) {
                LOG.severe("Failed to start Shadowsocks.");
                return OutlinePlugin.ErrorCode.SHADOWSOCKS_START_FAILURE;
              }
              if (performConnectivityChecks) {
                return checkServerConnectivity(Shadowsocks.LOCAL_SERVER_ADDRESS,
                    Integer.parseInt(Shadowsocks.LOCAL_SERVER_PORT), config.getString("host"),
                    config.getInt("port"));
              }
              return OutlinePlugin.ErrorCode.NO_ERROR;
            } catch (JSONException e) {
              LOG.log(Level.SEVERE, "Failed to parse the Shadowsocks config", e);
            }
            return OutlinePlugin.ErrorCode.SHADOWSOCKS_START_FAILURE;
          }
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
      broadcastVpnConnectivityChange(OutlinePlugin.ConnectionStatus.CONNECTED);
      startForegroundWithNotification(null, OutlinePlugin.ConnectionStatus.CONNECTED);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // Indicate that traffic will be sent over the current active network.
        // Although setting the underlying network to an available network may not seem like the
        // correct behavior, this method has been observed only to fire only when a preferred
        // network becomes available. It will not fire, for example, when the mobile network becomes
        // available if WiFi is the active network. Additionally, `getActiveNetwork` and
        // `getActiveNetworkInfo` have been observed to return the underlying network set by us.
        setUnderlyingNetworks(new Network[] {network});
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
      broadcastVpnConnectivityChange(OutlinePlugin.ConnectionStatus.RECONNECTING);
      startForegroundWithNotification(null, OutlinePlugin.ConnectionStatus.RECONNECTING);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        setUnderlyingNetworks(null);
      }
    }
  }

  private void startNetworkConnectivityMonitor() {
    final ConnectivityManager connectivityManager =
        (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
    NetworkRequest.Builder builder = new NetworkRequest.Builder();
    connectivityManager.registerNetworkCallback(builder.build(), networkConnectivityMonitor);
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

  /* Broadcast VPN start. |errorCode| determines whether the VPN was started successfully, or
   * specifies the error condition. */
  private void broadcastVpnStart(OutlinePlugin.ErrorCode errorCode) {
    Intent vpnStart = new Intent(OutlinePlugin.Action.START.value);
    vpnStart.putExtra(OutlinePlugin.IntentExtra.ERROR_CODE.value, errorCode.value);
    dispatchBroadcast(vpnStart);
  }

  /* Broadcast VPN stop. */
  private void broadcastVpnStop() {
    Intent vpnStop = new Intent(OutlinePlugin.Action.STOP.value);
    vpnStop.putExtra(OutlinePlugin.IntentExtra.ERROR_CODE.value,
                     OutlinePlugin.ErrorCode.NO_ERROR.value);
    dispatchBroadcast(vpnStop);
  }

  /* Broadcast change in the VPN connectivity. */
  private void broadcastVpnConnectivityChange(OutlinePlugin.ConnectionStatus status) {
    Intent statusChange = new Intent(OutlinePlugin.Action.ON_STATUS_CHANGE.value);
    statusChange.putExtra(OutlinePlugin.IntentExtra.PAYLOAD.value, status.value);
    statusChange.putExtra(
        OutlinePlugin.IntentExtra.ERROR_CODE.value, OutlinePlugin.ErrorCode.NO_ERROR.value);
    dispatchBroadcast(statusChange);
  }

  private void dispatchBroadcast(Intent broadcast) {
    if (activeConnectionId != null) {
      broadcast.putExtra(OutlinePlugin.IntentExtra.CONNECTION_ID.value, activeConnectionId);
    }
    LocalBroadcastManager.getInstance(this).sendBroadcast(broadcast);
  }

  // Autostart

  private void startLastSuccessfulConnectionOrExit() {
    LOG.info("Received an auto-connect request, loading last successful connection.");
    JSONObject connection = connectionStore.load();
    if (connection == null) {
      LOG.info("Last successful connection not found. User not connected at shutdown/install.");
      stopSelf();
      return;
    }
    if (VpnTunnelService.prepare(VpnTunnelService.this) != null) {
      // We cannot prepare the VPN when running as a background service, as it requires UI.
      LOG.warning("VPN not prepared, aborting auto-connect.");
      stopSelf();
      return;
    }
    try {
      final JSONObject config = connection.getJSONObject(CONNECTION_CONFIG_KEY);
      // Start the service in the foreground as per Android 8+ background service execution limits.
      startForegroundWithNotification(config, OutlinePlugin.ConnectionStatus.RECONNECTING);
      // Do not perform connectivity checks when connecting on startup. We should avoid failing the
      // connection due to a network error, as network may not be ready.
      startConnection(connection.getString(CONNECTION_ID_KEY), config, false);
    } catch (JSONException e) {
      LOG.log(Level.SEVERE, "Failed to retrieve JSON connection data", e);
      stopSelf();
    }
  }

  private void storeActiveConnection(final JSONObject config) {
    LOG.info("Storing active connection.");
    JSONObject connection = new JSONObject();
    try {
      connection.put(CONNECTION_ID_KEY, activeConnectionId).put(CONNECTION_CONFIG_KEY, config);
      connectionStore.save(connection);
    } catch (JSONException e) {
      LOG.log(Level.SEVERE, "Failed to store JSON connection data", e);
    }
    connectionStore.setConnectionStatus(OutlinePlugin.ConnectionStatus.CONNECTED);
  }

  // Foreground service & notifications

  /* Starts the service in the foreground and  displays a persistent notification. */
  private void startForegroundWithNotification(
      final JSONObject serverConfig, OutlinePlugin.ConnectionStatus status) {
    try {
      if (notificationBuilder == null) {
        // Cache the notification builder so we can update the existing notification - creating a
        // new notification has the side effect of resetting the connection timer.
        notificationBuilder = getNotificationBuilder(serverConfig);
      }
      final String statusStringResourceId = status == OutlinePlugin.ConnectionStatus.CONNECTED
          ? "connected_server_state"
          : "reconnecting_server_state";
      notificationBuilder.setContentText(getStringResource(statusStringResourceId));
      startForeground(NOTIFICATION_SERVICE_ID, notificationBuilder.getNotification());
    } catch (Exception e) {
      LOG.warning("Unable to display persistent notification");
    }
  }

  /* Returns a notification builder with the provided server configuration.  */
  private Notification.Builder getNotificationBuilder(final JSONObject serverConfig)
      throws Exception {
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
    return builder.setContentTitle(getServerName(serverConfig))
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
  private final String getServerName(final JSONObject serverConfig) {
    try {
      String serverName = serverConfig.getString("name");
      if (serverName == null || serverName.equals("")) {
        serverName = serverConfig.getString("host");
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
