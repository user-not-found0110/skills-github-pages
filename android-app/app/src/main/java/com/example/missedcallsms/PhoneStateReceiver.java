package com.example.missedcallsms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.os.Build;
import android.provider.CallLog;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class PhoneStateReceiver extends BroadcastReceiver {

    private static final String TAG = "MissedCallSMS";
    private static final String CHANNEL_ID = "missed_call_sms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }

        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        if (state == null) return;

        Prefs prefs = new Prefs(context);
        if (!prefs.isEnabled()) return;

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(state)) {
            String number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
            prefs.setWasRinging(true);
            prefs.setWasOffhook(false);
            if (number != null && !number.isEmpty()) {
                prefs.setIncomingNumber(number);
            }
        } else if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {
            prefs.setWasOffhook(true);
        } else if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {
            boolean wasMissed = prefs.wasRinging() && !prefs.wasOffhook();
            String cachedNumber = prefs.getIncomingNumber();
            prefs.clearCallState();

            if (wasMissed) {
                final PendingResult pendingResult = goAsync();
                new Thread(() -> {
                    try {
                        String number = pollCallLog(context, cachedNumber);
                        if (number != null && !number.isEmpty()) {
                            boolean sent = sendSms(context, prefs, number);
                            notify(context,
                                sent ? "Auto-reply sent" : "Auto-reply failed",
                                sent ? "SMS sent to " + number : "Failed to send SMS to " + number);
                        } else {
                            Log.w(TAG, "Missed call — caller number not found.");
                            notify(context, "Auto-reply failed",
                                "Missed call detected but caller number could not be found.");
                        }
                    } finally {
                        pendingResult.finish();
                    }
                }).start();
            }
        }
    }

    private String pollCallLog(Context context, String cached) {
        for (int attempt = 0; attempt < 5; attempt++) {
            try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
            String number = readMissedCallNumber(context);
            if (number != null) return number;
        }
        return cached;
    }

    private String readMissedCallNumber(Context context) {
        try {
            ContentResolver cr = context.getContentResolver();
            String[] projection = {CallLog.Calls.NUMBER, CallLog.Calls.TYPE};
            Cursor cursor = cr.query(
                CallLog.Calls.CONTENT_URI, projection, null, null,
                CallLog.Calls.DATE + " DESC"
            );
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int type = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE));
                        String number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                        if (type == CallLog.Calls.MISSED_TYPE
                                && number != null && !number.isEmpty() && !number.equals("-1")) {
                            return number;
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "READ_CALL_LOG denied");
        }
        return null;
    }

    private boolean sendSms(Context context, Prefs prefs, String toNumber) {
        String message = prefs.getMessage();
        int subId = prefs.getSubscriptionId();
        try {
            SmsManager smsManager = (subId == -1)
                ? SmsManager.getDefault()
                : SmsManager.getSmsManagerForSubscriptionId(subId);
            smsManager.sendTextMessage(toNumber, null, message, null, null);
            Log.i(TAG, "SMS sent to " + toNumber);
            return true;
        } catch (SecurityException e) {
            Log.e(TAG, "SEND_SMS denied: " + e.getMessage());
            return false;
        } catch (Exception e) {
            Log.e(TAG, "SMS failed: " + e.getMessage());
            return false;
        }
    }

    private void notify(Context context, String title, String text) {
        NotificationManager nm =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, "Missed Call SMS", NotificationManager.IMPORTANCE_DEFAULT));
        }
        nm.notify((int) System.currentTimeMillis(),
            new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .build());
    }
}
