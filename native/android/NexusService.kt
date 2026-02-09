
package com.nexusai.core

import android.app.*
import android.content.*
import android.os.*
import androidx.core.app.NotificationCompat
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform

/**
 * NEXUS FOREGROUND SERVICE
 * Manages the embedded Python runtime via Chaquopy.
 * Ensures LLM and Voice pipelines remain active in the background.
 */
class NexusService : Service() {
    private val NOTIFICATION_ID = 7337
    private val CHANNEL_ID = "NexusEngine_V3"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildPersistentNotification())
        
        // CRITICAL: Initialize Chaquopy before any Python modules are accessed
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(this))
        }
        
        // Start the background worker loop
        val py = Python.getInstance()
        try {
            // Optional: Warm up the model in the background
            py.getModule("core.models").get("GGUFChat").callAttr("get_instance")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder {
        return NexusBinder(this)
    }

    private fun buildPersistentNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nexus Enclave Active")
            .setContentText("Neural Kernel v3.1 Ready (Offline)")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Nexus Engine Core",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
