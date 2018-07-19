# Many of the Android build tools require glibc and are
# built for 32 bit systems. So, we use Ubuntu rather
# than something much more lightweight such as Alpine.
FROM ubuntu:18.04
RUN apt update && apt install -y wget unzip make clang && apt-get clean

# Android NDK:
#   https://developer.android.com/ndk/downloads/index.html
ENV ANDROID_NDK_VERSION 17b
RUN wget -O /tmp/android-ndk.zip "http://dl.google.com/android/repository/android-ndk-r${ANDROID_NDK_VERSION}-linux-x86_64.zip" && \
    unzip /tmp/android-ndk.zip -d /opt && \
    mv "/opt/android-ndk-r${ANDROID_NDK_VERSION}" /opt/android-ndk && \
    rm /tmp/android-ndk.zip
ENV PATH "${PATH}:/opt/android-ndk"
ENV ANDROID_NDK_HOME /opt/android-ndk
