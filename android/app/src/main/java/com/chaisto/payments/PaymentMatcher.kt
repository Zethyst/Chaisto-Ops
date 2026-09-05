package com.chaisto.payments

import org.json.JSONObject

/**
 * Decides whether a notification is a UPI payment *received* on this phone.
 *
 * This runs on the device and nothing that fails the check is stored, forwarded
 * or logged, so notifications that are not money arriving never leave the phone.
 *
 * There are two tiers, because the two sources carry different risk:
 *
 *  - Payment apps announce payments and little else, so a credit notification
 *    from one is taken at face value.
 *  - Messaging apps carry bank credit alerts mixed in with everything personal,
 *    so those must look like a bank credit *and* are refused outright if they
 *    look anything like a one-time password. Capturing OTPs would turn this
 *    from a record of collections into the raw material for taking over
 *    someone's bank account, which is a far worse thing to hold than the
 *    payment record is worth.
 */
object PaymentMatcher {

  /**
   * Apps whose whole purpose is payments.
   *
   * Package names should be confirmed against the apps actually installed on
   * the staff phones — a wrong id here means silence, not an error.
   */
  private val PAYMENT_APPS = setOf(
    "com.google.android.apps.nbu.paisa.user", // Google Pay (India)
    "com.phonepe.app",                        // PhonePe
    "com.phonepe.business",                   // PhonePe for Business
    "net.one97.paytm",                        // Paytm
    "net.one97.paytm.business",               // Paytm for Business
    "in.org.npci.upiapp",                     // BHIM
    "com.bharatpe.app",                       // BharatPe
    "com.bharatpe.merchant",                  // BharatPe merchant
    "com.dreamplug.androidapp",               // CRED
    "com.mobikwik_new",                       // MobiKwik
    "com.freecharge.android",                 // Freecharge
    "com.amazon.mShop.android.shopping",      // Amazon Pay (inside the shopping app)
    "com.jio.myjio",                          // JioPay
    "money.jupiter.app",                      // Jupiter
    "com.naviapp",                            // Navi
    "in.slice.android",                       // Slice
    "com.whatsapp",                           // WhatsApp Pay
    "com.whatsapp.w4b"                        // WhatsApp Business
  )

  /**
   * Apps that deliver bank alerts. Everything personal arrives here too, which
   * is why these go through the strict path below.
   */
  private val MESSAGING_APPS = setOf(
    "com.google.android.apps.messaging",   // Google Messages
    "com.samsung.android.messaging",       // Samsung Messages
    "com.android.mms",                     // AOSP / Xiaomi / others
    "com.android.messaging",               // AOSP Messaging
    "com.oneplus.mms",                     // OnePlus
    "com.oppo.quicksearchbox",             // ColorOS messages
    "com.vivo.messages",                   // Funtouch
    "com.transsion.mms",                   // Tecno / Infinix
    "com.truecaller",                      // Truecaller (default SMS app for many)
    "com.microsoft.android.smsorganizer"   // SMS Organizer
  )

  // "Received", "credited", "paid you" — money arriving.
  private val CREDIT_WORDS = listOf(
    "received", "credited", "credit alert", "paid you", "sent you",
    "payment of", "you got", "has been added"
  )

  // Money leaving. Checked after the credit words so "paid you" is not mistaken
  // for a payment he made.
  private val DEBIT_WORDS = listOf(
    "debited", "you paid", "sent to", "spent", "withdrawn", "payment to",
    "failed", "declined", "due", "reminder"
  )

  /**
   * A message carrying any of these is dropped and never stored, even when it
   * also mentions an amount. Banks put a code and a money figure in the same
   * message often enough that this has to win over every other rule.
   */
  private val SECRET_WORDS = listOf(
    "otp", "one time password", "one-time password", "verification code",
    "security code", "login code", "do not share", "don't share", "never share",
    "cvv", "atm pin", "upi pin", "mpin", "password", "authentication code"
  )

  /**
   * Something that marks a message as coming from a bank or a UPI rail rather
   * than from a person. Only the messaging tier has to clear this.
   */
  private val BANK_MARKERS = listOf(
    "a/c", "ac ", "acct", "account", "upi", "imps", "neft", "rtgs", "vpa",
    "ref no", "ref:", "bank", "wallet", "txn", "transaction", "credited to"
  )

  // ₹1,234.50 / Rs. 50 / INR 50 — the amount in any of the forms in use
  private val AMOUNT = Regex("""(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)

  fun isWatchedApp(packageName: String): Boolean =
    PAYMENT_APPS.contains(packageName) || MESSAGING_APPS.contains(packageName)

  /**
   * @return the capture to store, or null when this notification is not money
   *   arriving — in which case nothing about it is kept.
   */
  fun match(packageName: String, title: String, text: String, postedAt: Long): JSONObject? {
    val isPaymentApp = PAYMENT_APPS.contains(packageName)
    val isMessagingApp = MESSAGING_APPS.contains(packageName)
    if (!isPaymentApp && !isMessagingApp) return null

    val body = "$title $text".lowercase()

    // A code is a secret, not a payment record — refused from every source
    if (SECRET_WORDS.any { body.contains(it) }) return null

    if (CREDIT_WORDS.none { body.contains(it) }) return null
    if (DEBIT_WORDS.any { body.contains(it) }) return null

    // A message app has to look like a bank alert; a payment app does not, since
    // that is all it ever sends
    if (isMessagingApp && BANK_MARKERS.none { body.contains(it) }) return null

    val amount = AMOUNT.find(body)
      ?.groupValues?.get(1)
      ?.replace(",", "")
      ?.toDoubleOrNull()
      ?: return null
    if (amount <= 0) return null

    return JSONObject().apply {
      // Same payment, same phone, same second — a stable id so a notification
      // that is posted twice is not counted twice
      put("id", "${packageName}_${postedAt}_${amount}")
      put("app", packageName)
      put("amount", amount)
      put("title", title.take(120))
      put("text", text.take(240))
      put("capturedAt", postedAt)
    }
  }
}
