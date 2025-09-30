package com.sheetsolver

import android.os.Bundle // ⬅️ IMPORT 1: Required for the onCreate override
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash // ⬅️ IMPORT 2: Import the BootSplash library

class MainActivity : ReactActivity() {

    // ⬅️ Add the override for onCreate method
    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. Initialize the splash screen here.
        //    This tells the native side to display the BootTheme style.
        RNBootSplash.init(this, R.style.BootTheme)

        // 2. Call super.onCreate(null) as recommended by react-native-screens
        //    and common practice for RN after splash screen init.
        super.onCreate(null) 
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "SheetSolver"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}