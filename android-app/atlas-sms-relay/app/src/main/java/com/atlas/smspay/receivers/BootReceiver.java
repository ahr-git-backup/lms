package com.atlas.smspay.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.atlas.smspay.services.SmsRelayService;

/**
 * Without this, a phone restart silently stops the relay service and SMS
 * forwarding just stops until someone notices and manually reopens the
 * app — exactly the "phone restart" gap this whole app exists to close.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        Intent serviceIntent = new Intent(context, SmsRelayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
