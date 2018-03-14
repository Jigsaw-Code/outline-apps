Build the Outline Android app with Docker. No other tools are needed.

This approach is based on [microcontainers](https://www.iron.io/microcontainers-tiny-portable-containers/), using [mhart's Node.js images](https://github.com/mhart/alpine-node).

# Usage

First, install Docker:
https://docs.docker.com/engine/installation/

Then, prefix your commands with: `./tools/build/build.sh`

So, to install dependencies and build:
```bash
./tools/build/build.sh yarn
./tools/build/build.sh yarn build
```

What does this script do?:

 1. Starts a new Docker container, fetching the `outline/build-android` Docker image from Docker Hub if necessary.
 1. Runs the specified command in the container.
 1. Makes you the owner of all files in the repository (because commands in the container run as `root`, any new files created in the previous step will be owned by `root`).
 1. Deletes the container.

# Updating the Image

## Build

```bash
yarn do tools/build/build
```

## Tag

```bash
docker tag quay.io/outline/build-android:latest quay.io/outline/build-android:$(date +%F)
```

## Upload

```bash
docker push quay.io/outline/build-android:$(date +%F)
```

## Fix script

Update `IMAGE_NAME` in `build.sh` (`docker images --digests` to find the new image's digest) and prepare a pull request.
