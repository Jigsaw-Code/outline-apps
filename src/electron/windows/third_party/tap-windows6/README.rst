TAP-Windows driver (NDIS 6)
===========================

This is an NDIS 6 implementation of the TAP-Windows driver, used by OpenVPN and 
other apps. NDIS 6 drivers can run on Windows Vista or higher.

Build
-----

To build, the following prerequisites are required:

- Python 2.7
- Microsoft Windows 7 WDK (Windows Driver Kit)
- Windows code signing certificate
- Git (not strictly required, but useful for running commands using bundled bash shell)
- MakeNSIS (optional)
- Patched source code directory of **devcon** sample from WDK (optional)
- Prebuilt tapinstall.exe binaries (optional)

Make sure you add Python's install directory (usually c:\\python27) to the PATH 
environment variable.

These instructions have been tested on Windows 7 using Git Bash, as well as on 
Windows 2012 Server using Git Bash and Windows Powershell.

View build script options::

  $ python buildtap.py
  Usage: buildtap.py [options]

  Options:
    -h, --help         show this help message and exit
    -s SRC, --src=SRC  TAP-Windows top-level directory, default=<CWD>
    --ti=TAPINSTALL    tapinstall (i.e. devcon) directory (optional)
    -d, --debug        enable debug build
    -c, --clean        do an nmake clean before build
    -b, --build        build TAP-Windows and possibly tapinstall (add -c to
                       clean before build)
    --sign         sign the driver files (disabled by default)
    -p, --package      generate an NSIS installer from the compiled files
    --cert=CERT        Common name of code signing certificate, default=openvpn
    --crosscert=CERT   The cross-certificate file to use, default=MSCV-
                       VSClass3.cer
    --timestamp=URL    Timestamp URL to use, default=http://timestamp.verisign.c
                       om/scripts/timstamp.dll
    -a, --oas          Build for OpenVPN Access Server clients

Edit **version.m4** and **paths.py** as necessary then build::

  $ python buildtap.py -b

On successful completion, all build products will be placed in the "dist" 
directory as well as tap6.tar.gz. The NSIS installer package will be placed to
the build root directory.

Note that due to the strict driver signing requirements in Windows 10 you need
an EV certificate to sign the driver files. These EV certificates may be
stored inside a hardware device, which makes fully automated signing process
difficult, dangerous or impossible. Eventually the signing process will become
even more involved, with drivers having to be submitted to the Windows
Hardware Developer Center Dashboard portal. Therefore, by default, this
buildsystem no longer signs any files. You can revert to the old behavior
by using the --sign parameter.

Building tapinstall (optional)
------------------------------

The build system supports building tapinstall.exe (a.k.a. devcon.exe). However
the devcon source code in WinDDK does not build without modifications which
cannot be made public due to licensing restrictions. For these reasons the
default behavior is to reuse pre-built executables. To make sure the buildsystem
finds the executables create the following directory structure under
tap-windows6 directory:
::
  tapinstall
  └── 7600
      ├── objfre_wlh_amd64
      │   └── amd64
      │       └── tapinstall.exe
      └── objfre_wlh_x86
          └── i386
              └── tapinstall.exe

This structure is equal to what building tapinstall would create. Replace 7600
with the major number of your WinDDK version. Finally call buildtap.py with
"--ti=tapinstall".

Please note that the NSIS packaging (-p) step will fail if you don't have
tapinstall.exe available. Also don't use the "-c" flag or the above directories
will get wiped before MakeNSIS is able to find them.

Install/Update/Remove
---------------------

The driver can be installed using a command-line tool, tapinstall.exe, which is
bundled with OpenVPN and tap-windows installers. Note that in some versions of
OpenVPN tapinstall.exe is called devcon.exe. To install, update or remove the
tap-windows NDIS 6 driver follow these steps:

- place tapinstall.exe/devcon.exe to your PATH
- open an Administrator shell
- cd to **dist**
- cd to **amd64** or **i386** depending on your system's processor architecture.

Install::

  $ tapinstall install OemVista.inf TAP0901

Update::

  $ tapinstall update OemVista.inf TAP0901

Remove::

  $ tapinstall remove TAP0901

Notes on proxies
----------------

It is possible to build tap-windows6 without connectivity to the Internet but 
any attempt to timestamp the driver will fail. For this reason configure your 
outbound proxy server before starting the build. Note that the command prompt 
also needs to be restarted to make use of new proxy settings.

Notes on Authenticode signatures
--------------------------------

Recent Windows versions such as Windows 10 are fairly picky about the
Authenticode signatures of kernel-mode drivers. In addition making older Windows
versions such as Vista play along with signatures that Windows 10 accepts can be
rather challenging. A good starting point on this topic is the
`building tap-windows6 <https://community.openvpn.net/openvpn/wiki/BuildingTapWindows6>`_
page on the OpenVPN community wiki. As that page points out, having two
completely separate Authenticode signatures may be the only reasonable option.
Fortunately there is a tool, `Sign-Tap6 <https://github.com/mattock/sign-tap6/>`_,
which can be used to append secondary signatures to the tap-windows6 driver or
to handle the entire signing process if necessary.

License
-------

See the file `COPYING <COPYING>`_.
