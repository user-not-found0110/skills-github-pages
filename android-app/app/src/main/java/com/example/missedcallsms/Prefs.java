package com.example.missedcallsms;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.List;

class Prefs {
    private static final String NAME = "missed_call_sms";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SUB_ID = "subscription_id";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_WAS_RINGING = "was_ringing";
    private static final String KEY_WAS_OFFHOOK = "was_offhook";
    private static final String KEY_INCOMING_NUMBER = "incoming_number";
    private static final String KEY_LOG = "send_log";
    private static final int MAX_LOG = 50;

    private static final String DEFAULT_MESSAGE = "I missed your call. I\u2019ll ring you back shortly.";

    private final SharedPreferences sp;

    Prefs(Context ctx) {
        sp = ctx.getApplicationContext().getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    boolean isEnabled() { return sp.getBoolean(KEY_ENABLED, false); }
    void setEnabled(boolean v) { sp.edit().putBoolean(KEY_ENABLED, v).apply(); }

    int getSubscriptionId() { return sp.getInt(KEY_SUB_ID, -1); }
    void setSubscriptionId(int id) { sp.edit().putInt(KEY_SUB_ID, id).apply(); }

    String getMessage() { return sp.getString(KEY_MESSAGE, DEFAULT_MESSAGE); }
    void setMessage(String msg) { sp.edit().putString(KEY_MESSAGE, msg).apply(); }

    boolean wasRinging() { return sp.getBoolean(KEY_WAS_RINGING, false); }
    void setWasRinging(boolean v) { sp.edit().putBoolean(KEY_WAS_RINGING, v).commit(); }

    boolean wasOffhook() { return sp.getBoolean(KEY_WAS_OFFHOOK, false); }
    void setWasOffhook(boolean v) { sp.edit().putBoolean(KEY_WAS_OFFHOOK, v).commit(); }

    String getIncomingNumber() { return sp.getString(KEY_INCOMING_NUMBER, null); }
    void setIncomingNumber(String n) { sp.edit().putString(KEY_INCOMING_NUMBER, n).commit(); }

    void clearCallState() {
        sp.edit()
            .remove(KEY_WAS_RINGING)
            .remove(KEY_WAS_OFFHOOK)
            .remove(KEY_INCOMING_NUMBER)
            .commit();
    }

    void addLogEntry(String number) {
        String existing = sp.getString(KEY_LOG, "");
        String entry = System.currentTimeMillis() + "|" + number;
        String updated = existing.isEmpty() ? entry : entry + "\n" + existing;
        String[] lines = updated.split("\n");
        if (lines.length > MAX_LOG) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < MAX_LOG; i++) {
                if (i > 0) sb.append("\n");
                sb.append(lines[i]);
            }
            updated = sb.toString();
        }
        sp.edit().putString(KEY_LOG, updated).commit();
    }

    List<String[]> getLogEntries() {
        String raw = sp.getString(KEY_LOG, "");
        List<String[]> entries = new ArrayList<>();
        if (raw.isEmpty()) return entries;
        for (String line : raw.split("\n")) {
            String[] parts = line.split("\\|", 2);
            if (parts.length == 2) entries.add(parts);
        }
        return entries;
    }

    void clearLog() {
        sp.edit().remove(KEY_LOG).apply();
    }
}
