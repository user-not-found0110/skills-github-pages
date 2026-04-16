package com.example.missedcallsms;

import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.provider.CallLog;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;
import android.util.Log;

public class PhoneStateReceiver extends BroadcastReceiver {

    private static final String TAG = "MissedCallSMS";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // Nothing to do on boot; BroadcastReceiver re-registers automatically.
            return;
        }

        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        if (state == null) return;

        Prefs prefs = new Prefs(context);
        if (!prefs.isEnabled()) return;

        switch (state) {
            case TelephonyManager.EXTRA_STATE_RINGING: {
                String number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
                prefs.setWasRinging(true);
                prefs.setWasOffhook(false);
                if (number != null && !number.isEmpty()) {
                    prefs.setIncomingNumber(number);
                }
                break;
            }
            case TelephonyManager.EXTRA_STATE_OFFHOOK: {
                prefs.setWasOffhook(true);
                break;
            }
            case TelephonyManager.EXTRA_STATE_IDLE: {
                if (prefs.wasRinging() && !prefs.wasOffhook()) {
                    // Call went from ringing to idle without being answered = missed call
                    String number = resolveCallerNumber(context, prefs.getIncomingNumber());
                    if (number != null && !number.isEmpty()) {
                        sendSms(context, prefs, number);
                    } else {
                        Log.w(TAG, "Missed call detected but could not determine caller number.");
                    }
                }
                prefs.clearCallState();
                break;
            }
        }
    }

    private String resolveCallerNumber(Context context, String cached) {
        // Try CallLog first (most reliable on API 29+)
        try {
            ContentResolver cr = context.getContentResolver();
            String[] projection = {CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE};
            String selection = CallLog.Calls.TYPE + " = " + CallLog.Calls.MISSED_TYPE;
            Cursor cursor = cr.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                null,
                CallLog.Calls.DATE + " DESC"
            );
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        String number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                        if (number != null && !number.isEmpty() && !number.equals("-1")) {
                            return number;
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "READ_CALL_LOG permission denied, falling back to broadcast number");
        }
        return cached;
    }

    private void sendSms(Context context, Prefs prefs, String toNumber) {
        String message = prefs.getMessage();
        int subId = prefs.getSubscriptionId();
        try {
            SmsManager smsManager = (subId == -1)
                ? SmsManager.getDefault()
                : SmsManager.getSmsManagerForSubscriptionId(subId);
            smsManager.sendTextMessage(toNumber, null, message, null, null);
            Log.i(TAG, "Auto-reply SMS sent to " + toNumber);
        } catch (SecurityException e) {
            Log.e(TAG, "SEND_SMS permission denied: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS: " + e.getMessage());
        }
    }
}
