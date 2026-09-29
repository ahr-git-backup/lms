package com.atlas.smspay;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Stores the two things this app needs to know that aren't hard-coded:
 * where to send parsed SMS data, and the shared secret that proves this
 * app (not a random script) is the sender. Set once from MainActivity.
 */
public class Config {

    private static final String PREFS = "atlas_sms_relay_prefs";
    private static final String KEY_ENDPOINT = "endpoint_url";
    private static final String KEY_SECRET = "shared_secret";

    // Sensible default so a fresh install works without any setup —
    // can still be overridden from the app's settings screen if the
    // backend URL ever changes.
    private static final String DEFAULT_ENDPOINT = "https://quizbot.pages.dev/api/sms-payment/ingest";

    public static String getEndpoint(Context ctx) {
        return prefs(ctx).getString(KEY_ENDPOINT, DEFAULT_ENDPOINT);
    }

    public static void setEndpoint(Context ctx, String url) {
        prefs(ctx).edit().putString(KEY_ENDPOINT, url).apply();
    }

    public static String getSecret(Context ctx) {
        return prefs(ctx).getString(KEY_SECRET, "");
    }

    public static void setSecret(Context ctx, String secret) {
        prefs(ctx).edit().putString(KEY_SECRET, secret).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
