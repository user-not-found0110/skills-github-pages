package com.personalapp.missedcallreply

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.CallLog
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import android.telephony.SmsManager
import android.widget.Toast
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat

class CallStateService : Service() {

    companion object {
        private const val TAG = "CallStateService"
        private const val NOTIF_ID = 1001
        private const val CHANNEL_ID = "call_monitor_channel"
    }

    private var telephonyManager: TelephonyManager? = null
    private var callback: MissedCallTelephonyCallback? = null

    private var wasRinging = false
    private var wentOffHook = false

    @RequiresApi(Build.VERSION_CODES.S)
    private inner class MissedCallTelephonyCallback : TelephonyCallback(),
        TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
            handleCallState(state)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            Toast.makeText(this, "Requires Android 12+", Toast.LENGTH_LONG).show()
            stopSelf()
            return START_NOT_STICKY
        }

        val subId = PreferencesManager.getSubscriptionId(this)
        val tm = getSystemService(TelephonyManager::class.java)

        telephonyManager = if (subId != android.telephony.SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            tm.createForSubscriptionId(subId)
        } else {
            tm
        }

        val cb = MissedCallTelephonyCallback()
        callback = cb
        telephonyManager?.registerTelephonyCallback(mainExecutor, cb)

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            callback?.let { telephonyManager?.unregisterTelephonyCallback(it) }
        }
        callback = null
        telephonyManager = null
    }

    private fun handleCallState(state: Int) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                wasRinging = true
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (wasRinging) wentOffHook = true
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (wasRinging && !wentOffHook) {
                    queryAndSendReply()
                }
                wasRinging = false
                wentOffHook = false
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun queryAndSendReply() {
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                val cursor = contentResolver.query(
                    CallLog.Calls.CONTENT_URI,
                    arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE),
                    "${CallLog.Calls.TYPE} = ?",
                    arrayOf(CallLog.Calls.MISSED_TYPE.toString()),
                    "${CallLog.Calls.DATE} DESC"
                )
                cursor?.use {
                    if (it.moveToFirst()) {
                        val number = it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER))
                        if (!number.isNullOrBlank()) {
                            val message = PreferencesManager.getReplyMessage(this)
                            sendSmsReply(number, message)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to query call log", e)
            }
        }, 500L)
    }

    private fun sendSmsReply(number: String, message: String) {
        val subId = PreferencesManager.getSubscriptionId(this)
        try {
            @Suppress("DEPRECATION")
            val smsManager = SmsManager.getSmsManagerForSubscriptionId(subId)
            smsManager.sendTextMessage(number, null, message, null, null)
            Log.d(TAG, "SMS sent to $number")
        } catch (e: SecurityException) {
            Log.e(TAG, "SMS permission denied", e)
        } catch (e: Exception) {
            Log.e(TAG, "SMS send failed", e)
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(getString(R.string.notif_title))
        .setContentText(getString(R.string.notif_text))
        .setSmallIcon(R.drawable.ic_notification)
        .setOngoing(true)
        .build()
}
