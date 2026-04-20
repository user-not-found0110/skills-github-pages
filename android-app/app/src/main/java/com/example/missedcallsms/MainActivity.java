package com.example.missedcallsms;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final int REQ_PERMISSIONS = 1;

    private Prefs prefs;
    private Switch enableSwitch;
    private Spinner simSpinner;
    private EditText messageEdit;
    private TextView statusText;
    private TextView batteryWarning;
    private Button batteryBtn;

    private final List<Integer> subscriptionIds = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = new Prefs(this);

        enableSwitch = findViewById(R.id.switch_enable);
        simSpinner = findViewById(R.id.spinner_sim);
        messageEdit = findViewById(R.id.edit_message);
        statusText = findViewById(R.id.text_status);
        batteryWarning = findViewById(R.id.text_battery_warning);
        batteryBtn = findViewById(R.id.btn_battery);
        Button grantBtn = findViewById(R.id.btn_grant);
        Button saveBtn = findViewById(R.id.btn_save);

        enableSwitch.setChecked(prefs.isEnabled());
        messageEdit.setText(prefs.getMessage());

        grantBtn.setOnClickListener(v -> requestPermissions());
        saveBtn.setOnClickListener(v -> saveSettings());
        batteryBtn.setOnClickListener(v -> requestBatteryOptimizationExemption());

        updateStatusText();
        updateBatteryWarning();
        populateSimSpinner();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatusText();
        updateBatteryWarning();
    }

    private void updateBatteryWarning() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                batteryWarning.setText(
                    "Battery optimization is ON — Android may block calls from being detected. Tap below to fix.");
                batteryWarning.setVisibility(View.VISIBLE);
                batteryBtn.setVisibility(View.VISIBLE);
            } else {
                batteryWarning.setVisibility(View.GONE);
                batteryBtn.setVisibility(View.GONE);
            }
        }
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    private void populateSimSpinner() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
                != PackageManager.PERMISSION_GRANTED) {
            simSpinner.setEnabled(false);
            return;
        }

        SubscriptionManager sm = getSystemService(SubscriptionManager.class);
        List<SubscriptionInfo> sims = null;
        try {
            sims = sm.getActiveSubscriptionInfoList();
        } catch (Exception ignored) {}

        subscriptionIds.clear();
        List<String> labels = new ArrayList<>();

        if (sims != null && !sims.isEmpty()) {
            for (SubscriptionInfo info : sims) {
                CharSequence name = info.getDisplayName();
                boolean isEsim = Build.VERSION.SDK_INT >= 28 && info.isEmbedded();
                int slot = info.getSimSlotIndex();

                String label;
                if (name != null && name.length() > 0) {
                    label = name.toString();
                } else if (isEsim) {
                    label = "eSIM";
                } else {
                    label = "SIM " + (slot + 1);
                }
                if (isEsim) label = "[eSIM] " + label;

                String number = info.getNumber();
                if (number != null && !number.isEmpty()) label += " (" + number + ")";
                labels.add(label);
                subscriptionIds.add(info.getSubscriptionId());
            }
        } else {
            int defaultSubId = SubscriptionManager.getDefaultSmsSubscriptionId();
            labels.add("Default SIM");
            subscriptionIds.add(defaultSubId != SubscriptionManager.INVALID_SUBSCRIPTION_ID
                ? defaultSubId : -1);
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        simSpinner.setAdapter(adapter);
        simSpinner.setEnabled(true);

        int savedSubId = prefs.getSubscriptionId();
        int savedIndex = subscriptionIds.indexOf(savedSubId);
        if (savedIndex >= 0) simSpinner.setSelection(savedIndex);

        simSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> p, View v, int pos, long id) {}
            @Override public void onNothingSelected(AdapterView<?> p) {}
        });
    }

    private void saveSettings() {
        prefs.setEnabled(enableSwitch.isChecked());
        prefs.setMessage(messageEdit.getText().toString().trim());
        int selectedPos = simSpinner.getSelectedItemPosition();
        if (selectedPos >= 0 && selectedPos < subscriptionIds.size()) {
            prefs.setSubscriptionId(subscriptionIds.get(selectedPos));
        }
        Toast.makeText(this, "Settings saved.", Toast.LENGTH_SHORT).show();
        updateStatusText();
    }

    private void requestPermissions() {
        List<String> missing = new ArrayList<>();
        String[] base = {
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_NUMBERS
        };
        for (String p : base) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED)
                missing.add(p);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED)
                missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (missing.isEmpty()) {
            Toast.makeText(this, "All permissions already granted.", Toast.LENGTH_SHORT).show();
            populateSimSpinner();
        } else {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), REQ_PERMISSIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMISSIONS) {
            boolean allGranted = true;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) { allGranted = false; break; }
            }
            if (allGranted) {
                Toast.makeText(this, "All permissions granted!", Toast.LENGTH_SHORT).show();
                populateSimSpinner();
            } else {
                Toast.makeText(this,
                    "Some permissions denied. App may not work correctly.", Toast.LENGTH_LONG).show();
            }
            updateStatusText();
        }
    }

    private void updateStatusText() {
        boolean hasSms = ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS)
            == PackageManager.PERMISSION_GRANTED;
        boolean hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
            == PackageManager.PERMISSION_GRANTED;
        boolean hasCallLog = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG)
            == PackageManager.PERMISSION_GRANTED;

        if (!hasPhone || !hasSms || !hasCallLog) {
            statusText.setText("Permissions needed \u2014 tap Grant Permissions");
        } else if (!prefs.isEnabled()) {
            statusText.setText("Auto-reply is OFF. Toggle the switch and save.");
        } else {
            statusText.setText("Active \u2014 will auto-reply to missed calls.");
        }
    }
}
