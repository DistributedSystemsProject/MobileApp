# Mobile App

This is the React-Native cross-platform (Android and iOS) mobile application for locking/unlocking an Arduino Device through Bluetooth

# Requirements

Following the React-Native official guide you can set up your development environment (for Android and/or iOS):
https://reactnative.dev/docs/environment-setup

# Usage

Once you have downloaded the repository, just execute the command:

`npx react-native run-android`

or, if you want to run the app on an iOS device:

`npx react-native run-ios`

# Settings

In the `App.js` file, change the two `fetch()`, according to your server address:
```
fetch('https://SERVER_ADDRESS:8888/authorize-operation', { ...
fetch('https://SERVER_ADDRESS:8888/result', { ...
```

# Screenshots

<p>a) Locked device</p>
<img src="https://raw.githubusercontent.com/DistributedSystemsProject/MobileApp/master/src/images/screenshots/locked_screen.jpg" alt="Screen 1" width="216" height="468">
<br>
<p>b) Unlocked device</p>
<img src="https://raw.githubusercontent.com/DistributedSystemsProject/MobileApp/master/src/images/screenshots/unlocked_screen.jpg" alt="Screen 2" width="216" height="468">

