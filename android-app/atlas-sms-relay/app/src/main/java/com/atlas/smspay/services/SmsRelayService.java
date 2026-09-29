package com.atlas.smspay.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.atlas.smspay.ui.MainActivity;

/**
 * A foreground service exists purely so Android doesn't kill this app's
 * process while it's in the background — manifest-registered SMS receivers
 * still fire even if this service dies, but keeping it alive avoids the
 * OS deprioritizing/killing the whole app under memory pressure. The
 * ongoing notification is the (required, visible) trade-off for that.
 */
public class SmsRelayService extends Service {

    private static final String CHANNEL_ID = "atlas_sms_relay_channel";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        // START_STICKY: if the OS still kills this service under memory
        // pressure, ask it to recreate the service (with a null intent)
        // rather than leaving it stopped.
        return START_STICKY;
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "ATLAS SMS Relay", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("পেমেন্ট SMS পাঠানোর সার্ভিস চালু আছে");
            nm.createNotificationChannel(channel);
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, openIntent,
                PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("ATLAS SMS Relay চলছে")
                .setContentText("পেমেন্ট SMS মনিটর করা হচ্ছে")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
