package com.unifiedinbox;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Singleton bridge that receives notifications from NotificationListenerService
 * and injects them into the WebView.
 */
public class NotificationBridge {

    private static final String TAG = "NotificationBridge";
    private static NotificationBridge instance;

    private WebView webView;
    private boolean ready = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private NotificationBridge() {}

    public static synchronized NotificationBridge getInstance() {
        if (instance == null) {
            instance = new NotificationBridge();
        }
        return instance;
    }

    public void setWebView(WebView webView) {
        this.webView = webView;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }

    /**
     * Called from NotificationListenerService when a new notification is captured.
     */
    public void onNotificationReceived(String appName, String senderName, String message, String packageName) {
        if (!ready || webView == null) {
            Log.d(TAG, "WebView not ready, queuing notification: " + senderName);
            return;
        }

        mainHandler.post(() -> {
            try {
                JSONObject notification = new JSONObject();
                notification.put("app", normalizeAppName(appName));
                notification.put("sender", senderName != null ? senderName : "Unknown");
                notification.put("message", message != null ? message : "New message");
                notification.put("time", java.text.DateFormat.getTimeInstance(
                        java.text.DateFormat.SHORT).format(new java.util.Date()));
                notification.put("unreadCount", 1);
                notification.put("packageName", packageName != null ? packageName : "");

                String jsonString = notification.toString();
                String escapedJson = jsonString
                        .replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r");

                webView.evaluateJavascript(
                    "javascript:window.AndroidBridge.onNotification('" + escapedJson + "')",
                    null
                );
                Log.d(TAG, "Injected notification: " + senderName);
            } catch (Exception e) {
                Log.e(TAG, "Error injecting notification", e);
            }
        });
    }

    /**
     * Inject multiple notifications at once (for initial sync).
     */
    public void injectNotificationBatch(JSONArray notifications) {
        if (!ready || webView == null) return;

        mainHandler.post(() -> {
            try {
                String jsonString = notifications.toString();
                String escapedJson = jsonString
                        .replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r");

                webView.evaluateJavascript(
                    "javascript:window.AndroidBridge.onNotificationsBatch('" + escapedJson + "')",
                    null
                );
            } catch (Exception e) {
                Log.e(TAG, "Error injecting batch", e);
            }
        });
    }

    private String normalizeAppName(String name) {
        if (name == null) return "WhatsApp";
        String lower = name.toLowerCase();
        if (lower.contains("whatsapp")) return "WhatsApp";
        if (lower.contains("instagram")) return "Instagram";
        if (lower.contains("telegram")) return "Telegram";
        if (lower.contains("messenger")) return "Messenger";
        if (lower.contains("signal")) return "Signal";
        if (lower.contains("sms") || lower.contains("messages")) return "SMS";
        return name;
    }
}