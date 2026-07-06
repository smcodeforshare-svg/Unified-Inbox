# Unified Inbox - Android APK Builder

This Android app wraps your hosted web app (https://smcodeforshare-svg.github.io/Unified-Inbox/) in a WebView and uses Android's **NotificationListenerService** to **read real notifications** from WhatsApp, Instagram, Telegram, Messenger, Signal, SMS, and other messaging apps — then displays them directly inside your web app.

## How It Works

```
WhatsApp/Instagram/Telegram SMS etc.
        │
        ▼  (system notification)
NotificationListenerService
        │
        ▼
NotificationBridge (extracts sender, message)
        │
        ▼  (injects via JavaScript)
WebView → AndroidBridge.onNotification(data)
        │
        ▼
Your Web App displays the real message
```

## Build the APK Without Android Studio

### Option 1: GitHub Actions (Recommended - No Setup Required)

1. Push this entire repository to GitHub (including the `android-wrapper` folder and `.github` folder)
2. Go to your GitHub repo → **Actions** tab
3. The workflow "Build Android APK" will automatically run
4. When complete, download the APK from the **Artifacts** section
5. Install the APK on your Android phone

To manually trigger: Go to Actions → "Build Android APK" → "Run workflow"

### Option 2: VS Code + Extension

1. Install **"Android Development Tools"** extension in VS Code
2. Install **JDK 17** on your PC
3. Open the `android-wrapper` folder in VS Code
4. Open terminal and run:
   ```
   ./gradlew assembleDebug
   ```
5. APK will be at: `android-wrapper/app/build/outputs/apk/debug/app-debug.apk`

### Option 3: Termux on Android (Build on Phone)

If you have Termux on your Android phone, you can build there too.

## Installation on Phone

1. Install the APK on your Android phone
2. Open the app → It will ask for **Notification Access**
3. Go to Settings → Apps → Special App Access → Notification Access → Enable "Unified Inbox"
4. Go back to the app → It will now capture real notifications

## Supported Apps

| App | Package Name |
|-----|-------------|
| WhatsApp | com.whatsapp |
| WhatsApp Business | com.whatsapp.w4b |
| Instagram | com.instagram.android |
| Telegram | org.telegram.messenger |
| Messenger | com.facebook.orca |
| Messenger Lite | com.facebook.mlite |
| Signal | org.thoughtcrime.securesms |
| Google Messages | com.google.android.apps.messaging |
| Samsung Messages | com.samsung.android.messaging |
| Discord | com.discord |
| Slack | com.slack |

## Project Structure

```
android-wrapper/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/unifiedinbox/
│       │   ├── MainActivity.java        # WebView setup
│       │   ├── WebAppInterface.java      # JavaScript bridge
│       │   ├── NotificationBridge.java   # Notification -> WebView
│       │   └── NotificationListenerService.java  # System notif listener
│       └── res/
│           ├── layout/activity_main.xml
│           └── values/themes.xml
├── build.gradle
├── settings.gradle
├── gradle.properties
└── gradlew

.github/workflows/
└── build-apk.yml       # Auto-build APK on GitHub
```

## Permissions Required

- **INTERNET** - Load the web app
- **BIND_NOTIFICATION_LISTENER_SERVICE** - Read notifications from other apps (user must enable in Settings)
- **POST_NOTIFICATIONS** (Android 13+) - Show own notifications

## Troubleshooting

**No notifications appearing?**
1. Make sure you enabled Notification Access for "Unified Inbox" in Settings
2. Make sure the messaging app is installed and has notifications enabled
3. Try sending yourself a test message on WhatsApp/Telegram
4. Check that the web app loads correctly (it should show "Listening for real notifications…")