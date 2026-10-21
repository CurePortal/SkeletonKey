package org.skeletonkey.beacon

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the Flutter process alive while the ambient microphone stream is on.
 * The audio itself is captured by the Dart `record` plugin; this service only
 * holds the microphone foreground-service slot so Android does not suspend the
 * recorder when the app is minimized.
 */
class BeaconForegroundService : Service() {
    companion object {
        const val CHANNEL_ID = "beacon_ambient"
        const val NOTIFICATION_ID = 4211
    }

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Ambient stream",
                NotificationManager.IMPORTANCE_LOW,
            )
            channel.description = "Keeps SkeletonKey Beacon listening while minimized."
            manager.createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SkeletonKey Beacon")
            .setContentText("Ambient stream is on")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
