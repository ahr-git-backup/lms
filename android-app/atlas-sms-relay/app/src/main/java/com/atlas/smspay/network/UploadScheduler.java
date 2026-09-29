package com.atlas.smspay.network;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * Single entry point for "send this parsed payment to the backend,
 * reliably." Queues through WorkManager so: (1) it only runs once there's
 * actually a network connection, (2) a failure retries with exponential
 * backoff instead of being lost, and (3) the queued work survives the app
 * being killed and even a phone reboot (WorkManager persists its queue to
 * disk) — the same reason PipraPay's own app uses WorkManager for this.
 */
public class UploadScheduler {

    public static void enqueue(Context context, String trxId, String amount, String senderPhone, String rawSms, long receivedAt) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        Data input = new Data.Builder()
                .putString(UploadWorker.KEY_TRX_ID, trxId)
                .putString(UploadWorker.KEY_AMOUNT, amount)
                .putString(UploadWorker.KEY_SENDER_PHONE, senderPhone)
                .putString(UploadWorker.KEY_RAW_SMS, rawSms)
                .putLong(UploadWorker.KEY_RECEIVED_AT, receivedAt)
                .build();

        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(UploadWorker.class)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, OneTimeWorkRequest.MIN_BACKOFF_MILLIS, TimeUnit.MILLISECONDS)
                .setInputData(input)
                .build();

        WorkManager.getInstance(context).enqueue(request);
    }
}
