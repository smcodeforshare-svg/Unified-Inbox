package com.unifiedinbox;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * This service listens to ALL system notifications.
 * The user must grant notification access in Settings.
 *
 * When a new notification arrives from messaging apps,
 * it extracts the sender name and message, then forwards
 * to NotificationBridge which injects into the WebView.
 */
public class NotificationListenerService extends android.service.notification.NotificationListenerService {

    private static final String TAG = "NotifListener";
    private static final String[] MESSAGING_PACKAGES = {
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.instagram.android",
        "org.telegram.messenger",
        "org.telegram.messenger.web",
        "com.facebook.orca",
        "com.facebook.mlite",
        "org.thoughtcrime.securesms",
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.microsoft.skydrive",
        "com.discord",
        "com.slack"
    };

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();

        // Only process messaging app notifications
        if (!isMessagingApp(packageName)) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        // Extract notification details
        CharSequence titleCharSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCharSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextCharSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String sender = titleCharSeq != null ? titleCharSeq.toString() : "Unknown";
        String message = textCharSeq != null ? textCharSeq.toString() : "";
        if (message.isEmpty() && bigTextCharSeq != null) {
            message = bigTextCharSeq.toString();
        }

        // Skip non-message notifications (like "connected", "updates available", etc.)
        if (message.isEmpty() || sender.isEmpty()) return;
        if (isSystemMessage(sender, message)) return;

        Log.d(TAG, "Notification from " + packageName + " | Sender: " + sender + " | Msg: " + message);

        // Forward to the bridge which injects into WebView
        NotificationBridge.getInstance().onNotificationReceived(
            getAppName(packageName),
            sender,
            message,
            packageName
        );
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Not needed for now
    }

    @Override
    public void onListenerConnected() {
        Log.d(TAG, "Notification listener connected!");
    }

    @Override
    public void onListenerDisconnected() {
        Log.d(TAG, "Notification listener disconnected!");
    }

    private boolean isMessagingApp(String packageName) {
        for (String pkg : MESSAGING_PACKAGES) {
            if (pkg.equals(packageName)) return true;
        }
        return false;
    }

    private String getAppName(String packageName) {
        switch (packageName) {
            case "com.whatsapp":
            case "com.whatsapp.w4b":
                return "WhatsApp";
            case "com.instagram.android":
                return "Instagram";
            case "org.telegram.messenger":
            case "org.telegram.messenger.web":
                return "Telegram";
            case "com.facebook.orca":
            case "com.facebook.mlite":
                return "Messenger";
            case "org.thoughtcrime.securesms":
                return "Signal";
            case "com.google.android.apps.messaging":
            case "com.samsung.android.messaging":
            case "com.android.mms":
                return "SMS";
            default:
                return packageName;
        }
    }

    private boolean isSystemMessage(String sender, String message) {
        String lower = (sender + " " + message).toLowerCase();
        String[] ignoreKeywords = {
            "connected", "disconnected", "update available", "new version",
            "background", "syncing", "battery", "wifi", "bluetooth",
            "download", "upload", "installed", "updated"
        };
        for (String keyword : ignoreKeywords) {
            if (lower.contains(keyword)) return true;
        }
        return false;
    }
}