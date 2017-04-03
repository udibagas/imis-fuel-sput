#/bin/bash

cordova build android --release -- --keystore="phoenix.jks" --storePassword=bismillah --alias=phoenix
mv /home/udibagas/apps/imis/platforms/android/build/outputs/apk/android-release.apk /home/udibagas/apps/phoenix/imis-fuel.apk
scp /home/udibagas/apps/phoenix/imis-fuel.apk root@10.13.130.50:/var/www/html/phoenix/imis-fuel.apk
