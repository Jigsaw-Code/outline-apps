# `setsystemproxy`

## Introduction

`setsystemproxy` configures the system to use a HTTP proxy.

It's similar to, and borrows from, components in other VPNs such as Lantern and Shadowsocks:
* https://github.com/getlantern/sysproxy-cmd
* https://github.com/shadowsocks/sysproxy

## HOWTO Build

### Requirements

* A Windows system (these instructions were tested on Windows 10).
* Cygwin (32 bit), with the following packages:
    * `gcc-core`
    * `make`

### Steps

* Open a Cywin terminal.
* `cd` to `tools/setsystemproxy`, inside your clone of this repo.
* `make`
