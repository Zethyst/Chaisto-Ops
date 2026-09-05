package com.chaisto.payments

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * The captures waiting to be uploaded.
 *
 * The listener service runs whether or not the app is open — often it is not —
 * so a capture is held on the device until the app next runs and syncs it. The
 * buffer is capped: a phone left offline for a long time keeps its most recent
 * captures rather than growing without limit.
 */
class PaymentCaptureStore(context: Context) {

  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun add(capture: JSONObject) {
    val pending = pending()
    val id = capture.optString("id")

    // The same notification can be posted more than once (an update to it, or
    // the app rebuilding it) — one payment, one capture
    for (i in 0 until pending.length()) {
      if (pending.getJSONObject(i).optString("id") == id) return
    }

    pending.put(capture)
    while (pending.length() > MAX_PENDING) pending.remove(0)
    prefs.edit().putString(KEY_PENDING, pending.toString()).apply()
  }

  fun pending(): JSONArray =
    try {
      JSONArray(prefs.getString(KEY_PENDING, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  /** Drops the captures the server has accepted, keeping any that arrived since. */
  fun remove(ids: Set<String>) {
    val kept = JSONArray()
    val pending = pending()
    for (i in 0 until pending.length()) {
      val item = pending.getJSONObject(i)
      if (!ids.contains(item.optString("id"))) kept.put(item)
    }
    prefs.edit().putString(KEY_PENDING, kept.toString()).apply()
  }

  /**
   * Whether Android has the listener connected. Switching notification access
   * off is the obvious way to defeat this, so the state is recorded and
   * reported rather than being invisible.
   */
  var listenerConnected: Boolean
    get() = prefs.getBoolean(KEY_CONNECTED, false)
    set(value) {
      prefs.edit()
        .putBoolean(KEY_CONNECTED, value)
        .putLong(KEY_CONNECTED_CHANGED_AT, System.currentTimeMillis())
        .apply()
    }

  val listenerChangedAt: Long
    get() = prefs.getLong(KEY_CONNECTED_CHANGED_AT, 0L)

  private companion object {
    const val PREFS = "chaisto_payment_capture"
    const val KEY_PENDING = "pending"
    const val KEY_CONNECTED = "listener_connected"
    const val KEY_CONNECTED_CHANGED_AT = "listener_changed_at"
    const val MAX_PENDING = 500
  }
}
