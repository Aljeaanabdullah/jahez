package com.jahez.jahez

import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Phone integrity checks used before punching (PRD 5.4).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "jahez/integrity").setMethodCallHandler { call, result ->
            when (call.method) {
                "isRooted" -> result.success(isRooted())
                else -> result.notImplemented()
            }
        }
    }

    /** Common signs of a rooted phone: the `su` tool, root manager apps, or a test-keys build. */
    private fun isRooted(): Boolean {
        val suPaths = listOf(
            "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/su", "/system/bin/.ext/.su",
            "/system/usr/we-need-root/su-backup", "/system/xbin/mu", "/data/local/su", "/data/local/bin/su",
            "/data/local/xbin/su", "/su/bin/su", "/system/sd/xbin/su", "/system/bin/failsafe/su",
            "/system/app/Superuser.apk", "/system/app/SuperSU.apk", "/sbin/magisk", "/debug_ramdisk/magisk",
        )
        if (suPaths.any { File(it).exists() }) return true
        if (Build.TAGS?.contains("test-keys") == true) return true
        val rootApps = listOf("com.topjohnwu.magisk", "eu.chainfire.supersu", "com.noshufou.android.su", "com.koushikdutta.superuser")
        return rootApps.any { pkg ->
            try {
                packageManager.getPackageInfo(pkg, 0)
                true
            } catch (_: Exception) {
                false
            }
        }
    }
}
