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

import android.content.Context;
import android.content.SharedPreferences;
import java.util.logging.Logger;
import org.json.JSONException;
import org.json.JSONObject;
import org.outline.OutlinePlugin;

// Persistence layer for a single connection configuration. Uses |SharedPreferences| as the store.
class VpnConnectionStore {
  private static final Logger LOG = Logger.getLogger(VpnConnectionStore.class.getName());
  private static final String CONNECTION_KEY = "connection";
  private static final String CONNECTION_STATUS_KEY = "connectionStatus";

  private final SharedPreferences preferences;

  public VpnConnectionStore(Context context) {
    this.preferences = context.getSharedPreferences(
        VpnConnectionStore.class.getName(), Context.MODE_PRIVATE);
  }

  public void save(final JSONObject connection) {
    if (connection == null) {
      LOG.severe("Received null JSON connection");
      return;
    }
    SharedPreferences.Editor editor = preferences.edit();
    editor.putString(CONNECTION_KEY, connection.toString()).commit();
  }

  public JSONObject load() {
    final String jsonConnection = preferences.getString(CONNECTION_KEY, null);
    if (jsonConnection == null) {
      return null;
    }
    JSONObject connection = null;
    try {
      connection = new JSONObject(jsonConnection);
    } catch (JSONException e) {
      LOG.severe("Failed to deserialize JSON connection");
    }
    return connection;
  }

  public void clear() {
    SharedPreferences.Editor editor = preferences.edit();
    editor.remove(CONNECTION_KEY).commit();
  }

  public OutlinePlugin.ConnectionStatus getConnectionStatus() {
    final String connectionStatus = preferences.getString(
        CONNECTION_STATUS_KEY, OutlinePlugin.ConnectionStatus.DISCONNECTED.toString());
    return OutlinePlugin.ConnectionStatus.valueOf(connectionStatus);
  }

  public void setConnectionStatus(OutlinePlugin.ConnectionStatus status) {
    if (status == null) {
      LOG.severe("Received null connection status");
      return;
    }
    SharedPreferences.Editor editor = preferences.edit();
    editor.putString(CONNECTION_STATUS_KEY, status.toString()).commit();
  }
}
