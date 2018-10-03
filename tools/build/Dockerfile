# Many of the Android build tools require glibc and are
# built for 32 bit systems. Running such binaries is a
# lot easier on Ubuntu than on Alpine.  
FROM ubuntu:18.04

# We install curl because while wget may be much smaller,
# some of the install scripts themselves invoke curl.

# Notes on dependencies:
#  - Bower requires git
#  - gnupg is needed by the Node.js installer to add an Apt repository.
#  - Specify openjdk-8-jre-headless explicitly to prevent versions >8
#    from being installed, which aren't compatible with the Android tools.
RUN apt update && apt install -y curl unzip openjdk-8-jdk openjdk-8-jre-headless gradle git gnupg rsync && apt clean

# Node.js.
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt install -y nodejs

# Yarn.
# Set this explicitly because $HOME is set to / by default
# in Dockerfiles, confusing the yarn install script.
ENV HOME /root
RUN curl -sL https://yarnpkg.com/install.sh | bash -
ENV PATH $HOME/.yarn/bin:${PATH}

# https://stackoverflow.com/questions/25672924/run-bower-from-root-user-its-possible-how
RUN echo '{"allow_root": true}' > /root/.bowerrc

# https://cordova.apache.org/docs/en/latest/reference/cordova-cli/#cordova-telemetry-command
ENV CI=true

# Since the command-line Android development tools are poorly
# documented, these steps are cobbled together from lots of
# trial and error, old pinball machine parts, and various
# Dockerfiles lying around Github. Bitrise, in particular,
# maintains images with many useful hints:
#   https://github.com/bitrise-docker/android 

# Android SDK ("command line tools only"):
#   https://developer.android.com/studio/index.html#downloads
# This is version 26.1.1.
RUN curl -o /tmp/android-tools.zip https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip && \
    mkdir /opt/android-sdk && \
    unzip /tmp/android-tools.zip -d /opt/android-sdk && \
    rm /tmp/android-tools.zip
ENV PATH ${PATH}:/opt/android-sdk/tools/bin
ENV ANDROID_HOME /opt/android-sdk

# Android SDK Build Tools:
#   https://developer.android.com/studio/releases/build-tools.html
# To find the latest version's label:
#   sdkmanager --list|grep build-tools
ENV ANDROID_BUILD_TOOLS_VERSION 28.0.1
RUN yes | sdkmanager "build-tools;${ANDROID_BUILD_TOOLS_VERSION}"
