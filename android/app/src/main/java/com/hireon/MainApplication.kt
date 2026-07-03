package com.hireon

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createOrderNotificationChannel()
  }

  // "orders" channel (HIGH importance): naya-order FCM push isi par aata hai —
  // screen lock/off par bhi heads-up notification sound ke saath dikhta hai.
  private fun createOrderNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "orders",
        "Naye Orders",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Naye delivery order requests"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        enableVibration(true)
      }
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(channel)
    }
  }
}
