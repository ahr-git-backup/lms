package com.atlas.smspay.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.atlas.smspay.Config;
import com.atlas.smspay.R;
import com.atlas.smspay.services.SmsRelayService;

public class MainActivity extends AppCompatActivity {

    private static final int REQ_SMS_PERMISSION = 100;
    private static final int REQ_NOTIF_PERMISSION = 101;

    private TextView statusText;
    private EditText secretInput;
    private EditText endpointInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.status_text);
        secretInput = findViewById(R.id.secret_input);
        endpointInput = findViewById(R.id.endpoint_input);
        Button startButton = findViewById(R.id.start_button);
        Button batteryButton = findViewById(R.id.battery_button);

        secretInput.setText(Config.getSecret(this));
        endpointInput.setText(Config.getEndpoint(this));

        startButton.setOnClickListener(v -> {
            Config.setSecret(this, secretInput.getText().toString().trim());
            Config.setEndpoint(this, endpointInput.getText().toString().trim());
            requestPermissionsAndStart();
        });

        batteryButton.setOnClickListener(v -> requestIgnoreBatteryOptimizations());

        updateStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
    }

    private void requestPermissionsAndStart() {
        String[] permissions;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions = new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS, Manifest.permission.POST_NOTIFICATIONS};
        } else {
            permissions = new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS};
        }

        boolean allGranted = true;
        for (String p : permissions) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            startRelayService();
        } else {
            ActivityCompat.requestPermissions(this, permissions, REQ_SMS_PERMISSION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean allGranted = true;
        for (int r : grantResults) {
            if (r != PackageManager.PERMISSION_GRANTED) allGranted = false;
        }
        if (allGranted) {
            startRelayService();
        } else {
            Toast.makeText(this, "SMS পারমিশন ছাড়া এই অ্যাপ কাজ করবে না", Toast.LENGTH_LONG).show();
        }
    }

    private void startRelayService() {
        Intent serviceIntent = new Intent(this, SmsRelayService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        Toast.makeText(this, "সার্ভিস চালু হয়েছে", Toast.LENGTH_SHORT).show();
        updateStatus();
    }

    @SuppressWarnings("BatteryLife")
    private void requestIgnoreBatteryOptimizations() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        String packageName = getPackageName();
        if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + packageName));
            startActivity(intent);
        } else {
            Toast.makeText(this, "ব্যাটারি অপ্টিমাইজেশন ইতিমধ্যে বন্ধ আছে", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateStatus() {
        boolean hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        statusText.setText(hasPermission
                ? "স্ট্যাটাস: চালু আছে ✅"
                : "স্ট্যাটাস: SMS পারমিশন দেওয়া হয়নি ❌");
    }
}
