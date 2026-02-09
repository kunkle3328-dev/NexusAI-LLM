
package com.nexusai.core

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlin.concurrent.thread

class MicrophoneInput(private val context: Context) {
    private var isRecording = false
    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

    @SuppressLint("MissingPermission")
    fun start(onBufferAvailable: (ShortArray) -> Unit) {
        isRecording = true
        thread {
            val audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            val buffer = ShortArray(bufferSize)
            audioRecord.startRecording()

            while (isRecording) {
                val read = audioRecord.read(buffer, 0, buffer.size)
                if (read > 0) {
                    onBufferAvailable(buffer.copyOfRange(0, read))
                }
            }

            audioRecord.stop()
            audioRecord.release()
        }
    }

    fun stop() {
        isRecording = false
    }
}
