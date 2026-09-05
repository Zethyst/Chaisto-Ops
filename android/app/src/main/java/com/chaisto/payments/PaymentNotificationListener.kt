package com.chaisto.payments

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Watches for UPI payments arriving on this phone.
 *
 * Android hands this service every notification, so the filtering happens right
 * here, before anything is written down: only notifications from a payment app
 * that say money was received are kept (see [PaymentMatcher]). Everything else
 * is dropped where it arrives.
 *
 * The service is bound by the system and runs with the app closed, so captures
 * are buffered on the device and uploaded the next time the app runs.
 */
class PaymentNotificationListener : NotificationListenerService() {

  private val store by lazy { PaymentCaptureStore(applicationContext) }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val packageName = sbn?.packageName ?: return
    // Anything from an app that is not watched is dropped before it is read
    if (!PaymentMatcher.isWatchedApp(packageName)) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    // A bank SMS is longer than the collapsed line, and the amount is often in
    // the part that only the expanded notification shows
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))
      ?.toString().orEmpty()

    PaymentMatcher.match(packageName, title, text, sbn.postTime)?.let(store::add)
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    store.listenerConnected = true
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    // Notification access was switched off (or the service was killed). The app
    // reports this upward — monitoring going quiet should not look like a quiet day.
    store.listenerConnected = false
  }
}
