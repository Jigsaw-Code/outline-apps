# `setsystemroute`

## Introduction

`setsystemroute` configures a Windows system with a new default gateway, via which all network traffic *except for one destination IP* will be routed.

If the excluded IP is a proxy server, this may be used in conjunction with several other tools to produce a kind of "full system" VPN.

## HOWTO Build

### Requirements

* A Windows system (these instructions were tested on Windows 10).
* Cygwin (32 bit), with the following packages:
    * `gcc-core`
    * `make`

### Steps

* Open a Cywin terminal.
* `cd` to `tools/setsystemroute`, inside your clone of this repo.
* `make`
