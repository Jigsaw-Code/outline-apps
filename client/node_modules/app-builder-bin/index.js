"use strict"

const path = require("path")

function getPath() {
  if (process.env.USE_SYSTEM_APP_BUILDER === "true") {
    return "app-builder"
  }

  const platform = process.platform;
  const arch = process.arch
  if (platform === "darwin") {
    return path.join(__dirname, "mac", `app-builder_${arch === "x64" ? "amd64" : arch}`)
  }
  else if (platform === "win32" && arch === "arm64") {
    /**
     * Golang isn't available for Windows ARM64 yet, so an ARM64 binary
     * can't be built yet. However, Windows ARM64 does support ia32
     * emulation, so we can leverage the existing executable for ia32.
     * https://github.com/golang/go/issues/36439
     */
    return path.join(__dirname, "win", "ia32", "app-builder.exe")
  }
  else if (platform === "win32") {
    return path.join(__dirname, "win", arch, "app-builder.exe")
  }
  else {
    return path.join(__dirname, "linux", arch, "app-builder")
  }
}

exports.appBuilderPath = getPath()
