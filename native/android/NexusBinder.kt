
package com.nexusai.core

import android.os.Binder
import android.content.Context
import android.util.Log
import com.chaquo.python.Python
import org.json.JSONObject

/**
 * NEXUS BINDER v4.3.0
 * The high-speed bridge between Kotlin UI/IO and Python Neural Kernel.
 */
class NexusBinder(private val context: Context) : Binder() {

    fun initializeSystem() {
        try {
            val py = Python.getInstance()
            py.getModule("core.models").callAttr("initialize_system")
            py.getModule("core.voice").callAttr("init_voice")
        } catch (e: Exception) {
            Log.e("NexusAI", "Kernel Boot Error", e)
        }
    }

    /**
     * Sends raw microphone buffer to Whisper STT Enclave.
     * Invokes callback with partial transcription results.
     */
    fun sendAudioChunk(buffer: ShortArray, onPartial: (String) -> Unit) {
        try {
            val py = Python.getInstance()
            val partialText = py.getModule("core.voice").callAttr("process_audio_stream", buffer).toString()
            if (partialText.isNotEmpty()) {
                onPartial(partialText)
            }
        } catch (e: Exception) {
            Log.e("NexusAI", "STT Stream Error", e)
        }
    }

    /**
     * Routes partial transcriptions to the LLM Enclave for proactive reasoning.
     */
    fun sendUserPartial(text: String) {
        // Log user partial to the enclave state
        Log.d("NexusEnclave", "Neural Trace (Partial): $text")
    }

    /**
     * Synchronizes Token Generation with Piper TTS Synthesis.
     * AI starts speaking as soon as the first tokens emerge.
     */
    fun streamAIResponseToTTS(userText: String) {
        try {
            val py = Python.getInstance()
            val modelModule = py.getModule("core.models")
            val voiceModule = py.getModule("core.voice")
            
            // Initiate parallel streaming task
            val tokenIterator = modelModule.callAttr("stream_tokens", userText).asIterable()

            for (payload in tokenIterator) {
                val json = JSONObject(payload.toString())
                val token = json.getString("token")
                val isCode = json.getBoolean("is_code")

                // UI Update
                if (context is MainActivity) {
                    context.updateChatBubble(token, isCode)
                }

                // TTS Stream (Bypass code syntax for human feel)
                if (!isCode) {
                    voiceModule.callAttr("speak_token", token)
                }
            }
        } catch (e: Exception) {
            Log.e("NexusAI", "Duplex Stream Error", e)
        }
    }

    fun sendUserPrompt(prompt: String) {
        streamAIResponseToTTS(prompt)
    }

    fun interrupt() {
        try {
            Python.getInstance().getModule("core.models").callAttr("interrupt_stream")
        } catch (e: Exception) { }
    }

    fun sendTokenToTTS(token: String) {
        try {
            Python.getInstance().getModule("core.voice").callAttr("speak_token", token)
        } catch (e: Exception) { }
    }
}
