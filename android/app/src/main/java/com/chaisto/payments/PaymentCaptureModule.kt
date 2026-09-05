package com.chaisto.payments

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray

/**
 * The JS side of payment capture: check whether monitoring is on, send the
 * staff member to the one screen where Android lets them turn it on, and hand
 * over the captures waiting to be uploaded.
 */
class PaymentCaptureModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PaymentCapture"

  private val store by lazy { PaymentCaptureStore(reactApplicationContext) }

  /**
   * Whether the staff member has granted notification access. Only they can:
   * Android has no API to grant it, which is why the app can ask but never
   * assume it is on.
   */
  @ReactMethod
  fun isEnabled(promise: Promise) {
    try {
      val enabled = Settings.Secure.getString(
        reactApplicationContext.contentResolver,
        "enabled_notification_listeners"
      )
      val component = ComponentName(
        reactApplicationContext,
        PaymentNotificationListener::class.java
      )
      promise.resolve(
        enabled != null &&
          (enabled.contains(component.flattenToString()) ||
            enabled.contains(component.flattenToShortString()))
      )
    } catch (e: Exception) {
      promise.reject("payment_capture_state", e)
    }
  }

  /**
   * Opens Android's notification-access screen. There is no in-app grant and no
   * API to grant this — only the person holding the phone can switch it on, or
   * `adb shell settings put secure enabled_notification_listeners` when the
   * phone is being set up.
   *
   * On Android 11 and up this lands on Chaisto's own entry, one toggle away,
   * rather than on a list of every app on the phone.
   */
  @ReactMethod
  fun openSettings(promise: Promise) {
    val component = ComponentName(reactApplicationContext, PaymentNotificationListener::class.java)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      try {
        reactApplicationContext.startActivity(
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
            .putExtra(
              Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
              component.flattenToString()
            )
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        promise.resolve(true)
        return
      } catch (e: Exception) {
        // Some builds do not carry the per-app screen — fall through to the list
      }
    }

    try {
      reactApplicationContext.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("payment_capture_settings", e)
    }
  }

  /** The captures held on the device, oldest first. Reading does not clear them. */
  @ReactMethod
  fun getPending(promise: Promise) {
    try {
      val pending = store.pending()
      val result: WritableArray = Arguments.createArray()
      for (i in 0 until pending.length()) {
        val item = pending.getJSONObject(i)
        result.pushMap(Arguments.createMap().apply {
          putString("id", item.optString("id"))
          putString("app", item.optString("app"))
          putDouble("amount", item.optDouble("amount", 0.0))
          putString("title", item.optString("title"))
          putString("text", item.optString("text"))
          putDouble("capturedAt", item.optLong("capturedAt", 0L).toDouble())
        })
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("payment_capture_pending", e)
    }
  }

  /** Drops the captures the server has accepted. */
  @ReactMethod
  fun clearPending(ids: ReadableArray, promise: Promise) {
    try {
      val accepted = mutableSetOf<String>()
      for (i in 0 until ids.size()) accepted.add(ids.getString(i))
      store.remove(accepted)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("payment_capture_clear", e)
    }
  }

  /**
   * Whether Android currently has the listener bound, and when that last
   * changed.
   *
   * This is not the same question as [isEnabled]. On MIUI and other aggressive
   * builds the permission stays granted while the system kills the service, so
   * a phone can read as "allowed" and be recording nothing at all. Granted but
   * not connected is the state worth shouting about.
   */
  @ReactMethod
  fun getListenerState(promise: Promise) {
    promise.resolve(Arguments.createMap().apply {
      putBoolean("connected", store.listenerConnected)
      putDouble("changedAt", store.listenerChangedAt.toDouble())
    })
  }

  /**
   * Whether the phone has been told to stop putting Chaisto to sleep. Without
   * this, MIUI and friends kill the listener within hours of the screen going
   * off and the day's payments go unrecorded.
   */
  @ReactMethod
  fun isBatteryUnrestricted(promise: Promise) {
    try {
      val power = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      promise.resolve(power.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestBatteryUnrestricted(promise: Promise) {
    try {
      reactApplicationContext.startActivity(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          .setData(Uri.parse("package:" + reactApplicationContext.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * Opens the vendor's autostart screen — MIUI's in particular, where an app
   * that is not on the autostart list does not come back after a reboot or a
   * memory clean, whatever else it has been granted.
   *
   * Each of these is a vendor activity that may not exist; the first one the
   * phone can actually resolve is used, and the app's own settings page is the
   * fallback so the staff member always lands somewhere useful.
   */
  @ReactMethod
  fun openAutostartSettings(promise: Promise) {
    val candidates = listOf(
      // Xiaomi / Redmi / Poco
      "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
      // Oppo / Realme
      "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
      "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
      // Vivo
      "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
      // Huawei / Honor
      "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      // Samsung
      "com.samsung.android.lool" to "com.samsung.android.sm.ui.battery.BatteryActivity"
    )

    for ((pkg, cls) in candidates) {
      val intent = Intent().setComponent(ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (intent.resolveActivity(reactApplicationContext.packageManager) != null) {
        try {
          reactApplicationContext.startActivity(intent)
          promise.resolve(true)
          return
        } catch (e: Exception) {
          // Present but not launchable by us — try the next one
        }
      }
    }

    try {
      reactApplicationContext.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.parse("package:" + reactApplicationContext.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }
}
