package com.unifiedinbox;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * JavaScript interface that the web app calls.
 * The web app's AndroidBridge calls these methods.
 */
public class WebAppInterface {

    private static final String TAG = "WebAppInterface";
    private final Activity activity;
    private final WebView webView;

    public WebAppInterface(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /**
     * Called by the web app to signal it's ready.
     * The bridge will then start injecting notifications.
     */
    @JavascriptInterface
    public void onWebAppReady() {
        Log.d(TAG, "Web app is ready. Starting notification listener.");
        // Trigger the notification listener service
        NotificationBridge.getInstance().setWebView(webView);
        NotificationBridge.getInstance().setReady(true);
    }

    /**
     * Called by the web app to launch another app on the device.
     */
    @JavascriptInterface
    public void launchApp(String packageName, String contactName) {
        Log.d(TAG, "Attempting to launch: " + packageName);
        try {
            Intent intent = activity.getPackageManager().getLaunchIntentForPackage(packageName);
            if (intent != null) {
                activity.startActivity(intent);
            } else {
                // Try opening Play Store or deep link
                try {
                    Intent storeIntent = new Intent(Intent.ACTION_VIEW);
                    storeIntent.setData(Uri.parse("market://details?id=" + packageName));
                    activity.startActivity(storeIntent);
                } catch (Exception e2) {
                    Log.e(TAG, "Could not launch app: " + packageName);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error launching app", e);
        }
    }
}