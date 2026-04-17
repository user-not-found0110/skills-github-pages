package com.example.missedcallsms;

import android.content.Context;
import android.content.SharedPreferences;

class Prefs {
    private static final String NAME = "missed_call_sms";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_SUB_ID = "subscription_id";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_WAS_RINGING = "was_ringing";
    private static final String KEY_WAS_OFFHOOK = "was_offhook";
    private static final String KEY_INCOMING_NUMBER = "incoming_number";

    private static final String DEFAULT_MESSAGE = "I missed your call. I'll ring you back shortly.";

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

    // Call state uses commit() (synchronous) so it survives process death between broadcasts
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
}
