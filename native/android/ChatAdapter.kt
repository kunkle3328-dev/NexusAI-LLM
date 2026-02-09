
package com.nexusai.core

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.nexusai.R

class ChatAdapter(private val messages: MutableList<Message>) :
    RecyclerView.Adapter<ChatAdapter.ChatViewHolder>() {

    inner class ChatViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val bubbleText: TextView = view.findViewById(R.id.bubble_text)
        val codeContainer: LinearLayout = view.findViewById(R.id.code_container)
        val codeText: TextView = view.findViewById(R.id.code_text)
        val copyButton: ImageButton = view.findViewById(R.id.copy_button)
        val bubbleContainer: View = view.findViewById(R.id.bubble_container)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.chat_bubble_item, parent, false)
        return ChatViewHolder(view)
    }

    override fun getItemCount() = messages.size

    override fun onBindViewHolder(holder: ChatViewHolder, position: Int) {
        val message = messages[position]

        if (message.isCodeBlock) {
            holder.bubbleText.visibility = View.GONE
            holder.codeContainer.visibility = View.VISIBLE
            holder.codeText.text = message.content
            
            holder.copyButton.setOnClickListener {
                val clipboard = holder.itemView.context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("Nexus AI Code", holder.codeText.text)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(holder.itemView.context, "Code copied!", Toast.LENGTH_SHORT).show()
            }
        } else {
            holder.bubbleText.visibility = View.VISIBLE
            holder.codeContainer.visibility = View.GONE
            holder.bubbleText.text = message.content
        }

        val background = if (message.role == "user") R.drawable.bubble_user else R.drawable.bubble_ai
        holder.bubbleContainer.background = ContextCompat.getDrawable(holder.itemView.context, background)
    }

    fun addMessage(message: Message) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }

    fun appendToken(token: String, isCode: Boolean) {
        if (messages.isEmpty() || messages.last().role == "user") {
            messages.add(Message(role = "assistant", isCodeBlock = isCode))
        }
        
        val last = messages.last()
        last.content += token
        last.isCodeBlock = isCode
        notifyItemChanged(messages.size - 1)
    }
}
