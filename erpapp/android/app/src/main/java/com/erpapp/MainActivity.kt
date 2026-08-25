package com.erpapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.view.KeyEvent
import com.github.kevinejohn.keyevent.KeyEventModule

class MainActivity : ReactActivity() {

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    
    val keyCode = event.keyCode
    val action = event.action
    
    // Forward to react-native-keyevent
    if (action == KeyEvent.ACTION_DOWN) {
      KeyEventModule.getInstance().onKeyDownEvent(keyCode, event)
    } else if (action == KeyEvent.ACTION_UP) {
      KeyEventModule.getInstance().onKeyUpEvent(keyCode, event)
    }
    
    // Completely swallow keys from hardware keyboards/scanners so they don't type into TextInputs
    // Completely swallow alphanumeric and ENTER keys from ANY keyboard.
    // Software keyboards (IME) use InputConnection and bypass dispatchKeyEvent for characters,
    // so this will only block hardware keyboards and barcode scanners from typing into TextInputs.
    if ((keyCode >= KeyEvent.KEYCODE_0 && keyCode <= KeyEvent.KEYCODE_9) ||
        (keyCode >= KeyEvent.KEYCODE_A && keyCode <= KeyEvent.KEYCODE_Z) ||
        keyCode == KeyEvent.KEYCODE_ENTER || 
        keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
        return true // Stop propagation to React Native UI TextInputs!
    }
    
    return super.dispatchKeyEvent(event)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "erpapp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
