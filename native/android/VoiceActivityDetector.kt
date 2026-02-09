
package com.nexusai.core

import kotlin.math.sqrt

class VoiceActivityDetector {
    private val threshold = 500.0 // Adjusted for Nexus Enclave MIC sensitivity
    
    fun isSpeaking(buffer: ShortArray): Boolean {
        var sum = 0.0
        for (sample in buffer) {
            sum += (sample * sample).toDouble()
        }
        val rms = sqrt(sum / buffer.size)
        return rms > threshold
    }
}
