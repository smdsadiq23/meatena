# Meatena Native Mobile

This is the separate bare React Native app for Meatena Butchery Operations.
It is independent from the existing Expo app in `../billing-mobile`.

## What is included

- Native Android and iOS project folders.
- Login against the shared backend.
- Backend health/KNET status.
- POS billing with manual invoice number and company details.
- Customer selection.
- Cash payment recording.
- KNET payment link creation.
- WhatsApp sharing through the same `wa.me` link flow as the current apps.
- Stock lookup.
- Invoice history.
- Today reports.
- Admin status screen.

## Run

Start Metro:

```sh
npm start
```

Or use the separated local port:

```sh
npm run start:8084
```

Run Android:

```sh
npm run android
```

With the separated port:

```sh
npm run android:8084
```

Build the Android debug APK:

```sh
npm run android:apk
```

Build a standalone APK that opens without Metro:

```sh
npm run android:standalone
```

Install the built APK on a connected device:

```sh
npm run android:install-apk
```

Install the standalone APK on a connected device:

```sh
npm run android:install-standalone
```

The debug APK is generated here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The standalone APK is generated here:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Run iOS:

```sh
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

With the separated port:

```sh
npm run ios:8084
```

## iOS Compatibility

The iOS project is configured for iPhone and iPad through the generated
`ios/MeatenaNative.xcworkspace`.

Local development settings already included:

- CocoaPods installed with `npm run ios:pods`.
- iOS app display name set to `Meatena`.
- Local HTTP backend access allowed for development.
- Local network permission text added for testing against a Mac backend on LAN.
- Safe-area support wired through `react-native-safe-area-context`.

Use the workspace file in Xcode:

```text
ios/MeatenaNative.xcworkspace
```

If Xcode says an iOS platform is missing, open Xcode > Settings > Components
and install the matching iOS runtime/platform shown by Xcode.

## Backend URL

The login and Admin screens include a `Backend URL / IP` setup section.

Defaults:

- Android emulator: `http://10.0.2.2:3003`
- iOS simulator: `http://localhost:3003`
- Physical phone: use your Mac LAN IP, for example `http://192.168.1.100:3003`

The app accepts either a full URL or a bare IP/host. If you type:

```text
192.168.1.100:3003
```

it will normalize it to:

```text
http://192.168.1.100:3003
```

On a physical phone, do not use `localhost`; it points to the phone itself.

## Notes

The Expo app remains available at `../billing-mobile`. Keep it until the native
app has full receipt upload/PDF sharing parity with production device testing.
