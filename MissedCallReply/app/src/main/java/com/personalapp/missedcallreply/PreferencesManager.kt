package com.personalapp.missedcallreply

import android.content.Context
import android.telephony.SubscriptionManager

object PreferencesManager {

    private const val PREFS_NAME = "missed_call_prefs"
    private const val KEY_ENABLED = "enabled"
    private const val KEY_SUB_ID = "subscription_id"
    private const val KEY_REPLY_MESSAGE = "reply_message"
    private const val DEFAULT_MESSAGE = "Sorry I missed your call. I'll call you back soon."

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) =
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()

    fun getSubscriptionId(context: Context): Int =
        prefs(context).getInt(KEY_SUB_ID, SubscriptionManager.INVALID_SUBSCRIPTION_ID)

    fun setSubscriptionId(context: Context, subId: Int) =
        prefs(context).edit().putInt(KEY_SUB_ID, subId).apply()

    fun getReplyMessage(context: Context): String =
        prefs(context).getString(KEY_REPLY_MESSAGE, DEFAULT_MESSAGE) ?: DEFAULT_MESSAGE

    fun setReplyMessage(context: Context, message: String) =
        prefs(context).edit().putString(KEY_REPLY_MESSAGE, message).apply()

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
