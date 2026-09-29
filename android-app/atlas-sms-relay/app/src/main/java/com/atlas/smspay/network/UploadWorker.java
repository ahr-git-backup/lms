package com.atlas.smspay.network;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.atlas.smspay.Config;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Does the actual network POST for one parsed SMS. Run through WorkManager
 * (see UploadScheduler) so Android handles retry/backoff and survives the
 * app process being killed — this is the same "queue it, don't just fire
 * and forget" reliability trick that makes SMS-forwarder apps not lose
 * payments when the phone briefly has no internet.
 */
public class UploadWorker extends Worker {

    private static final String TAG = "AtlasSmsUpload";

    public static final String KEY_TRX_ID = "trx_id";
    public static final String KEY_AMOUNT = "amount";
    public static final String KEY_SENDER_PHONE = "sender_phone";
    public static final String KEY_RAW_SMS = "raw_sms";
    public static final String KEY_RECEIVED_AT = "received_at";

    public UploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Data input = getInputData();
        String trxId = input.getString(KEY_TRX_ID);
        String amount = input.getString(KEY_AMOUNT);
        String senderPhone = input.getString(KEY_SENDER_PHONE);
        String rawSms = input.getString(KEY_RAW_SMS);
        long receivedAt = input.getLong(KEY_RECEIVED_AT, System.currentTimeMillis());

        Context ctx = getApplicationContext();
        String endpoint = Config.getEndpoint(ctx);
        String secret = Config.getSecret(ctx);

        try {
            JSONObject payload = new JSONObject();
            payload.put("secret", secret);
            payload.put("trx_id", trxId);
            payload.put("amount", amount);
            payload.put("sender_phone", senderPhone);
            payload.put("raw_sms", rawSms);
            payload.put("received_at", receivedAt);

            int code = post(endpoint, payload);
            if (code >= 200 && code < 300) {
                Log.i(TAG, "Uploaded trx=" + trxId + " OK");
                return Result.success();
            }
            if (code >= 400 && code < 500) {
                // Bad request (e.g. malformed payload) — retrying won't
                // help, don't burn battery/data on repeated identical failures.
                Log.w(TAG, "Upload rejected (HTTP " + code + "), not retrying: trx=" + trxId);
                return Result.failure();
            }
            Log.w(TAG, "Upload failed (HTTP " + code + "), will retry: trx=" + trxId);
            return Result.retry();
        } catch (JSONException | java.io.IOException e) {
            Log.w(TAG, "Upload error, will retry: " + e.getMessage());
            return Result.retry();
        }
    }

    private int post(String urlStr, JSONObject payload) throws java.io.IOException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }
}
