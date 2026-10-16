package com.xsiloflex.netmeter;

import android.content.ComponentName;
import android.os.Build;
import android.os.Bundle;
import android.service.quicksettings.TileService;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT < 24) return;
        try {
            TileService.requestListeningState(
                    getApplicationContext(),
                    new ComponentName(getApplicationContext(), IpTileService.class));
        } catch (Exception ignored) {
        }
    }
}
