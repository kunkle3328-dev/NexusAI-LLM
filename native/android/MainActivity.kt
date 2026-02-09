
package com.nexusai.core

import android.os.Bundle
import android.widget.EditText
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.nexusai.R

class MainActivity : AppCompatActivity() {

    private lateinit var chatRecycler: RecyclerView
    private lateinit var inputField: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var voiceOrb: ImageButton

    private val chatAdapter = ChatAdapter(mutableListOf())
    private lateinit var voiceController: VoiceController
    private lateinit var nexusBinder: NexusBinder

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        chatRecycler = findViewById(R.id.chat_recycler_view)
        inputField = findViewById(R.id.input_field)
        sendButton = findViewById(R.id.send_button)
        voiceOrb = findViewById(R.id.voice_orb)

        chatRecycler.layoutManager = LinearLayoutManager(this)
        chatRecycler.adapter = chatAdapter

        // Initialize Nexus Enclave components
        nexusBinder = NexusBinder(this)
        voiceController = VoiceController(this, nexusBinder)

        sendButton.setOnClickListener {
            val userText = inputField.text.toString()
            if(userText.isNotBlank()) {
                val message = Message(tokens = mutableListOf(userText), role = "user", content = userText)
                chatAdapter.addMessage(message)
                inputField.text.clear()
                nexusBinder.sendUserPrompt(userText)
            }
        }

        voiceOrb.setOnClickListener {
            if (voiceController.isCurrentlyListening()) {
                voiceController.stopHandsFree()
                voiceOrb.setImageResource(R.drawable.ic_mic)
            } else {
                voiceController.startHandsFree()
                voiceOrb.setImageResource(R.drawable.ic_stop)
                // Start pulse animation
                voiceOrb.animate().scaleX(1.2f).scaleY(1.2f).setDuration(500).withEndAction {
                    voiceOrb.animate().scaleX(1f).scaleY(1f).setDuration(500).start()
                }.start()
            }
        }
    }

    /**
     * Called from NexusBinder to update UI with streaming tokens
     */
    fun updateChatBubble(token: String, isCode: Boolean) {
        runOnUiThread {
            chatAdapter.appendToken(token, isCode)
            chatRecycler.smoothScrollToPosition(chatAdapter.itemCount - 1)
        }
    }

    fun updateUserPartialTranscription(text: String) {
        runOnUiThread {
            // Update UI with partial STT results
        }
    }
}
