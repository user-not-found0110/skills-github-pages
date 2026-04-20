package com.example.missedcallsms;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.os.Build;
import android.provider.CallLog;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
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
            int incomingSubId = getIncomingSubId(intent);
            int savedSubId = prefs.getSubscriptionId();
            boolean matched = isMonitoredSim(incomingSubId, savedSubId);

            // Debug: always show which SIMs are being compared
            showNotification(context, matched ? "Call on monitored SIM" : "Call on other SIM — skipping",
                "incoming subId=" + incomingSubId + "  saved subId=" + savedSubId);

            if (!matched) return;
            String number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
            prefs.setWasRinging(true);
            prefs.setWasOffhook(false);
            if (number != null && !number.isEmpty()) {
                prefs.setIncomingNumber(number);
            }
        } else if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(state)) {
            if (prefs.wasRinging()) prefs.setWasOffhook(true);
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
                            sendSmsWithReceipt(context, prefs, number);
                        } else {
                            showNotification(context, "Auto-reply failed",
                                "Missed call detected but caller number could not be found.");
                        }
                    } finally {
                        pendingResult.finish();
                    }
                }).start();
            }
        }
    }

    private void sendSmsWithReceipt(Context context, Prefs prefs, String toNumber) {
        String message = prefs.getMessage();
        int subId = prefs.getSubscriptionId();
        String action = "com.example.missedcallsms.SMS_SENT_" + System.currentTimeMillis();

        PendingIntent sentPI = PendingIntent.getBroadcast(
            context, 0, new Intent(action),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT);

        BroadcastReceiver sentReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent i) {
                try { ctx.unregisterReceiver(this); } catch (Exception ignored) {}
                int code = getResultCode();
                if (code == android.app.Activity.RESULT_OK) {
                    prefs.addLogEntry(toNumber);
                    showNotification(ctx, "Auto-reply sent", "SMS sent to " + toNumber);
                } else {
                    showNotification(ctx, "Auto-reply failed",
                        "To: " + toNumber + "  subId: " + subId + "  error: " + smsErrorReason(code));
                }
            }
        };

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(sentReceiver, new IntentFilter(action),
                    Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(sentReceiver, new IntentFilter(action));
            }
            SmsManager smsManager = (subId == -1)
                ? SmsManager.getDefault()
                : SmsManager.getSmsManagerForSubscriptionId(subId);
            smsManager.sendTextMessage(toNumber, null, message, sentPI, null);
        } catch (SecurityException e) {
            try { context.unregisterReceiver(sentReceiver); } catch (Exception ignored) {}
            showNotification(context, "Auto-reply failed", "SEND_SMS permission denied");
        } catch (Exception e) {
            try { context.unregisterReceiver(sentReceiver); } catch (Exception ignored) {}
            showNotification(context, "Auto-reply failed", "Exception: " + e.getMessage());
        }
    }

    private String smsErrorReason(int code) {
        if (code == SmsManager.RESULT_ERROR_GENERIC_FAILURE) return "generic failure";
        if (code == SmsManager.RESULT_ERROR_NO_SERVICE)      return "no service";
        if (code == SmsManager.RESULT_ERROR_RADIO_OFF)       return "radio off";
        if (code == SmsManager.RESULT_ERROR_NULL_PDU)        return "null PDU";
        return "code " + code;
    }

    private int getIncomingSubId(Intent intent) {
        int subId = SubscriptionManager.INVALID_SUBSCRIPTION_ID;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            subId = intent.getIntExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX,
                SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        }
        if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            subId = intent.getIntExtra("subscription", SubscriptionManager.INVALID_SUBSCRIPTION_ID);
        }
        return subId;
    }

    private boolean isMonitoredSim(int incomingSubId, int savedSubId) {
        if (savedSubId == -1) return true;
        if (incomingSubId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) return true;
        return incomingSubId == savedSubId;
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
            Cursor cursor = cr.query(CallLog.Calls.CONTENT_URI, projection, null, null,
                CallLog.Calls.DATE + " DESC");
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
                } finally { cursor.close(); }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "READ_CALL_LOG denied");
        }
        return null;
    }

    private void showNotification(Context context, String title, String text) {
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
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .build());
    }
}
