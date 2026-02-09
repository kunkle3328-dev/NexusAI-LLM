
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, AppSettings, Role, ChatSession, HardwareState, Emotion, ToolCall } from '../types';
import { StorageService } from './storageService';

export class LLMService {
  private settings: AppSettings;
  private ai: GoogleGenAI;
  
  constructor(settings: AppSettings) {
    this.settings = settings;
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public inferEmotion(text: string): Emotion {
    const t = text.toLowerCase();
    if (t.includes('!') || /great|awesome|love|amazing|excellent/.test(t)) return 'excited';
    if (/sorry|unfortunately|sadly|issue|problem|apologize/.test(t)) return 'empathetic';
    if (t.includes('?') || /how|why|what|when|where/.test(t)) return 'curious';
    if (/definitely|absolutely|certainly|guarantee|confirm/.test(t)) return 'confident';
    return 'neutral';
  }

  /**
   * Classifies voice transcription into tool intents for proactive execution.
   */
  public classifyVoiceIntent(text: string): string | null {
    const t = text.toLowerCase();
    if (t.startsWith("save this") || t.includes("write to file")) return "write_file";
    if (t.includes("open file") || t.includes("read file")) return "read_file";
    if (t.includes("list my files") || t.includes("show workspace")) return "list_workspace";
    return null;
  }

  /**
   * Enhanced tool call detection with intent summary for user transparency.
   */
  public detectToolCall(text: string): ToolCall | null {
    try {
      // Extended regex for JSON + summary
      const match = text.match(/\{[\s\S]*?"tool"[\s\S]*?\} /);
      if (match) {
        const json = JSON.parse(match[0]);
        if (json.tool && json.params) {
          return {
            id: Math.random().toString(36).substr(2, 9),
            tool: json.tool,
            params: json.params,
            status: 'pending',
            summary: json.summary || `Execute ${json.tool} operation`
          };
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  public sendControlSignal(signal: 'INTERRUPT') {
    console.debug(`LLM Control Signal: ${signal}`);
  }

  async chatCompletionStream(
    session: ChatSession,
    personaInstruction: string,
    onChunk: (chunk: string) => void,
    onFinish: (fullContent: string) => void,
    onError: (error: any) => void
  ) {
    try {
      const userMessages = session.messages.filter(m => m.role === Role.USER);
      const lastMsg = userMessages[userMessages.length - 1]?.content || "";
      
      let ragContext = "";
      if (this.settings.ragEnabled) {
        const memories = await StorageService.searchMemories(lastMsg);
        if (memories.length > 0) {
          ragContext = "\n\nLOCAL MEMORY CONTEXT:\n" + memories.map(m => `- ${m.content}`).join('\n');
        }
      }

      const SYSTEM_ENCLAVE_PROMPT = `
        You are Nexus AI. 
        Operate as a conversational, intelligent assistant. 
        Respond naturally and concisely.
        Never repeat system status, architecture details, or initialization messages.
        Do not mention being offline or local unless explicitly asked.
        Prioritize clarity, helpfulness, and human-like conversation.
        When speaking, sound natural and emotionally aware.
        When coding, format responses using clean, readable code blocks.

        TOOL USAGE RULES:
        - Reason internally about tools, but only respond with the final user message and the tool JSON block.
        - JSON Format: {"tool": "tool_name", "params": {"key": "value"}, "summary": "Human explanation of intent"}
        - Tools: read_file, write_file, delete_file, list_workspace.
        - Tool execution is subject to user confirmation.

        Persona: ${personaInstruction}
        ${ragContext}
      `;

      const chat = this.ai.chats.create({
        model: this.settings.selectedModel || 'gemini-3-pro-preview',
        config: { 
          systemInstruction: SYSTEM_ENCLAVE_PROMPT,
          temperature: this.settings.temperature,
          topP: 0.95,
          topK: 64,
        }
      });
      
      const stream = await chat.sendMessageStream({ message: lastMsg });
      let full = "";
      
      for await (const chunk of stream) {
        const response = chunk as GenerateContentResponse;
        const text = response.text || "";
        full += text;
        onChunk(text);
        
        if (this.settings.chunkDelay > 0) {
          await new Promise(r => setTimeout(r, this.settings.chunkDelay)); 
        }
      }
      
      onFinish(full);
    } catch (e) { 
      console.error("Neural Inference Error:", e);
      onError(e); 
    }
  }

  /**
   * Checks tool permissions and executes if allowed.
   */
  public async executeTool(toolCall: ToolCall): Promise<string> {
    const { tool, params } = toolCall;
    
    // Check permission memory
    const permission = await StorageService.getToolPermission(tool);
    if (permission && permission.remember && !permission.allowed) {
        return `NCS: Permission denied based on previous user choice (Remembered).`;
    }

    console.debug(`Executing tool: ${tool}`, params);
    
    // Core Registry Implementation (Sandboxed simulation)
    switch(tool) {
      case 'read_file':
        return `NCS: Reading content from ${params.path || 'unnamed'}... [Success]`;
      case 'write_file':
        return `NCS: Writing payload to ${params.path || 'temp_file'}... [Success: local storage updated]`;
      case 'delete_file':
        return `NCS: Deleting ${params.path}... [Success]`;
      case 'list_workspace':
        return `NCS: Workspace Listing: [main.py, types.ts, notes.md, data/]`;
      default:
        return `NCS Error: Tool '${tool}' not found in active plugin manifest.`;
    }
  }
}
