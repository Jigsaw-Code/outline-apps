# Outline Apps

![Build and Test](https://github.com/Jigsaw-Code/outline-apps/actions/workflows/build_and_test_debug.yml/badge.svg?branch=master) [![Mattermost](https://badgen.net/badge/Mattermost/Outline%20Community/blue)](https://community.internetfreedomfestival.org/community/channels/outline-community) [![Reddit](https://badgen.net/badge/Reddit/r%2Foutlinevpn/orange)](https://www.reddit.com/r/outlinevpn/)

> **Test coverage currently only tracks the Outline Client Apple Libraries and Web UI code:**
>
> [![codecov](https://codecov.io/gh/Jigsaw-Code/outline-apps/branch/master/graph/badge.svg?token=gasD8v5tjn)](https://codecov.io/gh/Jigsaw-Code/outline-apps)

TODO: Write a project description

## Workspaces

### [Outline Client](outline_client/README.md)

The Outline Client is a cross-platform VPN or proxy client for Windows, macOS, iOS, Android, and Debian-based Linux distros.

#### How to checkout only the Outline Client

```sh
# TODO: have outline_apps manage this
git sparse-checkout set outline_client
```

#### How to run commands against the Outline Client

```sh
./outline_apps outline_client lint
```

### [Outline Manager](outline_server/src/server_manager/README.md)

Coming Soon!

### [Outline Server](outline_server/src/shadowbox/README.md)

Coming Soon!

### [Outline SDK Examples: Access Key Tester](outline_sdk_examples/access_key_tester/README.md)

Coming Soon!

## Resources

### Life of a Packet

[How does the Outline Client work?](docs/life_of_a_packet.md)

### Accepting a server invite

[Looking for instructions on how to accept a server invite?](docs/invitation_instructions.md)

### Support

For support and to contact us, see: https://support.getoutline.org.
