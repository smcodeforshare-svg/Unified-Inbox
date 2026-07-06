package com.unifiedinbox;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private TextView statusText;
    private Button grantPermissionButton;
    private static final String WEB_APP_URL = "https://smcodeforshare-svg.github.io/Unified-Inbox/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        statusText = findViewById(R.id.statusText);
        grantPermissionButton = findViewById(R.id.grantPermissionButton);

        setupWebView();
        checkNotificationPermission();
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Enable debugging (optional, for Chrome DevTools)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Add JavaScript interface for communication back from web app
        webView.addJavascriptInterface(
            new WebAppInterface(this, webView),
            "AndroidBridge"
        );

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                statusText.setText("Connected");
                statusText.setTextColor(getColor(android.R.color.holo_green_light));
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load the web app
        webView.loadUrl(WEB_APP_URL);
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ needs POST_NOTIFICATIONS permission
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                    1001
                );
            }
        }

        // Check if notification listener is enabled
        if (!isNotificationListenerEnabled()) {
            grantPermissionButton.setVisibility(View.VISIBLE);
            statusText.setText("Notification access not granted");
            statusText.setTextColor(getColor(android.R.color.holo_red_light));

            grantPermissionButton.setOnClickListener(v -> {
                openNotificationAccessSettings();
            });
        } else {
            grantPermissionButton.setVisibility(View.GONE);
            statusText.setText("Ready");
            statusText.setTextColor(getColor(android.R.color.holo_green_light));
        }
    }

    private boolean isNotificationListenerEnabled() {
        String packageName = getPackageName();
        String flat = Settings.Secure.getString(
            getContentResolver(),
            "enabled_notification_listeners"
        );
        return flat != null && flat.contains(packageName);
    }

    private void openNotificationAccessSettings() {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        startActivity(intent);
        Toast.makeText(this,
            "Enable 'Unified Inbox' notification access in Settings",
            Toast.LENGTH_LONG).show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh permission check when returning from settings
        checkNotificationPermission();
    }
}