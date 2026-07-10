package com.hireon

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // react-native-screens: saved instance state se fragment restore hone par
  // "Screen fragments should never be restored" crash aata hai — activity
  // relaunch (jaise lock-screen full-screen intent, config change) par app
  // gir jaati thi. Fix: state null karke do (RN khud UI wapas banata hai).
  // https://github.com/software-mansion/react-native-screens/issues/17
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "HIREON"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
