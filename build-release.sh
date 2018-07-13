#/bin/bash

cordova build android --release -- --keystore="phoenix.jks" --storePassword=bismillah --alias=phoenix
cp platforms/android/build/outputs/apk/android-release.apk ../imis-sput/public/imis-fuel.apk
