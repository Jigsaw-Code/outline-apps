# `setsystemproxy`

## Introduction

`setsystemproxy` configures the system to use a HTTP proxy.

It's similar to, and borrows from, components in other VPNs such as Lantern and Shadowsocks:
* https://github.com/getlantern/sysproxy-cmd
* https://github.com/shadowsocks/sysproxy

## HOWTO Build

### Requirements

* A Windows system (these instructions were tested on Windows 10).
* https://mingw-w64.org/

### Steps

* Open a Mingw-w64 terminal.
* `cd` to `tools/setsystemproxy`, inside your clone of this repo.
* `mingw32-make`
