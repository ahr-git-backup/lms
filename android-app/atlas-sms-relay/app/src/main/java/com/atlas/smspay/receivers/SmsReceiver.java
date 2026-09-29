package com.atlas.smspay.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.atlas.smspay.SmsParser;
import com.atlas.smspay.network.UploadScheduler;

/**
 * Fires for every incoming SMS on the device. Only bKash/Nagad "payment
 * received" messages are actually acted on — SmsParser.parse() returns
 * null (and this receiver does nothing) for anything else, so a normal
 * SMS from a friend or an OTP is never sent anywhere.
 */
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "AtlasSmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        StringBuilder fullBody = new StringBuilder();
        String sender = null;
        for (Object pdu : pdus) {
            SmsMessage msg = SmsMessage.createFromPdu((byte[]) pdu, bundle.getString("format"));
            if (msg == null) continue;
            if (sender == null) sender = msg.getOriginatingAddress();
            fullBody.append(msg.getMessageBody());
        }

        String body = fullBody.toString();
        SmsParser.ParsedPayment parsed = SmsParser.parse(body);
        if (parsed == null) {
            return; // not a recognized payment SMS — ignore
        }

        Log.i(TAG, "Payment SMS detected: trxId=" + parsed.trxId + " amount=" + parsed.amount);

        UploadScheduler.enqueue(
                context,
                parsed.trxId,
                parsed.amount,
                parsed.senderPhone,
                body,
                System.currentTimeMillis()
        );
    }
}
