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

package org.outline.shadowsocks;

import android.content.Context;
import android.content.res.AssetManager;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.logging.Logger;

public class ShadowsocksAcl {
  private static final Logger LOG = Logger.getLogger(ShadowsocksAcl.class.getName());
  private static final String ACL_ASSETS_PATH = "bypass/bypass.acl";
  private static final String ACL_FILE_NAME = "bypass.acl";
  private Context context;
  private String filesDir;

  public ShadowsocksAcl(final Context context) {
    this.context = context;
    this.filesDir = context.getFilesDir().getAbsolutePath();
    sync();
  }

  public String getAclPath() {
    return String.format("%s/%s", filesDir, ACL_FILE_NAME);
  }

  private void sync() {
    copyAsset(context.getAssets(), ACL_ASSETS_PATH, getAclPath());
  }

  private boolean copyAsset(
      final AssetManager assetManager, final String fromAssetPath, final String toPath) {
    InputStream in = null;
    OutputStream out = null;
    try {
      in = assetManager.open(fromAssetPath);
      new File(toPath).createNewFile();
      out = new FileOutputStream(toPath);
      copyFile(in, out);
      in.close();
      out.flush();
      out.close();
    } catch (Exception e) {
      e.printStackTrace();
      return false;
    }
    return true;
  }

  private void copyFile(InputStream in, OutputStream out) throws IOException {
    byte[] buffer = new byte[1024];
    int read;
    while ((read = in.read(buffer)) != -1) {
      out.write(buffer, 0, read);
    }
  }
}
