
package com.nexusai.core

import android.content.Context
import android.util.Log

/**
 * NEXUS HUMAN-LEVEL VOICE CONTROLLER
 * v4.3.0 - Optimized for zero-latency duplex interaction.
 */
class VoiceController(
    private val context: Context,
    private val binder: NexusBinder
) {
    private var isListening = false
    private val micStream = MicrophoneInput(context)
    private val vad = VoiceActivityDetector()

    fun startHandsFree() {
        if (isListening) return
        isListening = true

        Log.d("NexusEnclave", "Neural Voice Link Established: Hands-Free Mode")

        micStream.start { buffer ->
            // Automated Voice Activity Detection
            if (vad.isSpeaking(buffer)) {
                // Real-time audio pipeline to Whisper STT Enclave
                binder.sendAudioChunk(buffer) { partialText ->
                    if (partialText.isNotBlank()) {
                        Log.d("NexusSTT", "Real-time Transcription: $partialText")
                        
                        // Push partial results to UI and LLM Enclave immediately
                        if (context is MainActivity) {
                            context.updateUserPartialTranscription(partialText)
                        }
                        
                        // Bridge to LLM for proactive token generation
                        binder.sendUserPartial(partialText)
                        
                        // Initiate live TTS streaming for human-like response timing
                        binder.streamAIResponseToTTS(partialText)
                    }
                }
            }
        }
    }

    fun stopHandsFree() {
        isListening = false
        micStream.stop()
        Log.d("NexusEnclave", "Neural Voice Link Severed")
    }

    fun isCurrentlyListening(): Boolean = isListening

    /**
     * Human-prosody Token Streaming to TTS
     */
    fun speakResponse(streamTokens: Sequence<String>) {
        for (token in streamTokens) {
            // Check for barge-in: pause if user starts talking again
            if (vad.isRecentUserActivity()) {
                binder.interrupt()
                break
            }
            binder.sendTokenToTTS(token)
        }
    }
}
