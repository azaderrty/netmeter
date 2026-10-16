package com.xsiloflex.netmeter;

import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class IpTileService extends TileService {

    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile String currentIp = null;
    private volatile boolean loading = false;

    @Override
    public void onStartListening() {
        super.onStartListening();
        updateTile();
        refreshIp();
    }

    @Override
    public void onClick() {
        super.onClick();
        if (currentIp == null || currentIp.isEmpty()) {
            refreshIp();
            openApp();
            return;
        }
        copyToClipboard(currentIp);
        updateTileLabel(currentIp);
        openApp();
    }

    private void refreshIp() {
        if (loading) return;
        loading = true;
        updateTileLabel(null);
        new Thread(() -> {
            String ip = fetchCloudflareIp();
            if (ip == null || ip.isEmpty()) {
                ip = fetchIpwho();
            }
            final String result = ip;
            loading = false;
            main.post(() -> {
                if (result != null && !result.isEmpty()) {
                    currentIp = result;
                }
                updateTile();
            });
        }, "netmeter-ip").start();
    }

    private String fetchCloudflareIp() {
        HttpURLConnection c = null;
        try {
            URL url = new URL("https://speed.cloudflare.com/__down?bytes=1");
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("GET");
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setUseCaches(false);
            String ip = c.getHeaderField("cf-meta-ip");
            if (ip != null && !ip.isEmpty()) return ip;
            drain(c.getInputStream());
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
        return null;
    }

    private String fetchIpwho() {
        HttpURLConnection c = null;
        try {
            URL url = new URL("https://ipwho.is/?fields=ip");
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("GET");
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setUseCaches(false);
            try (InputStream is = c.getInputStream();
                 BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                JSONObject json = new JSONObject(sb.toString());
                String ip = json.optString("ip", null);
                if (ip != null && !ip.isEmpty()) return ip;
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
        return null;
    }

    private void drain(InputStream is) {
        if (is == null) return;
        try {
            byte[] buf = new byte[1024];
            while (is.read(buf) != -1) { /* discard */ }
            is.close();
        } catch (Exception ignored) {
        }
    }

    private void updateTile() {
        updateTileLabel(currentIp);
    }

    private void updateTileLabel(String ip) {
        Tile tile = getQsTile();
        if (tile == null) return;
        String text = (ip == null || ip.isEmpty()) ? "IP…" : ip;
        tile.setLabel("NetMeter");
        if (Build.VERSION.SDK_INT >= 29) {
            tile.setSubtitle(text);
        } else {
            tile.setLabel(text);
        }
        tile.setState(Tile.STATE_ACTIVE);
        tile.updateTile();
    }

    private void copyToClipboard(String text) {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) {
                cm.setPrimaryClip(ClipData.newPlainText("IP", text));
            }
        } catch (Exception ignored) {
        }
    }

    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) {
            PendingIntent pi = PendingIntent.getActivity(
                    this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            startActivityAndCollapse(pi);
        } else {
            startActivityAndCollapse(intent);
        }
    }
}
