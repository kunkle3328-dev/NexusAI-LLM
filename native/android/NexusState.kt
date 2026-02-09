
package com.nexusai.core

/**
 * NEXUS CORE STATE
 * Represents the real-time status of the local AI kernel.
 */
data class NexusState(
    val status: String = "IDLE",
    val modelLoaded: String? = null,
    val ramUsed: Long = 0,
    val thermalLevel: Int = 0,
    val isProcessing: Boolean = false,
    val voiceActive: Boolean = false
)
