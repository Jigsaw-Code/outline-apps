# Outline Client Backend

## Environment Preparation

```sh
go install golang.org/x/mobile/cmd/gomobile@latest
export GOBIN="$HOME/go/bin/"   -- or your customized go binary folder
export PATH="$GOBIN:$PATH"
gomobile init
```

## Build

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
gomobile clean
gomobile bind -target android ./outline/client/backend
```
