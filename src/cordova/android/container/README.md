# Android Environment Container

This approach is based on [microcontainers](https://www.iron.io/microcontainers-tiny-portable-containers/), using [mhart's Node.js images](https://github.com/mhart/alpine-node).

# Usage

First, install Docker:
https://docs.docker.com/engine/installation/

Then, run your actions with: `npm run action cordova/android/container/run`

For example, to build the Android App:

```bash
npm run action cordova/android/container/run cordova/build android
```

What does this script do?:

1.  Builds a new image.
2.  Runs the specified command in the container.
3.  Makes you the owner of all files in the repository (because commands in the container run as `root`, any new files created in the previous step will be owned by `root`).
4.  Deletes the container.
