
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, AppSettings, Role, ChatSession, HardwareState } from '../types';

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

  public sendTelemetry(state: HardwareState) {
    // Simulated enclave telemetry sync for kernel awareness
    console.debug("Kernel Telemetry Sync:", state);
  }

  public sendControlSignal(signal: 'INTERRUPT' | 'HOTSWAP' | 'START_VOICE' | 'STOP_VOICE') {
    // Interrupt or modify streaming pipeline execution
    console.debug("Kernel Control Signal:", signal);
  }

  async chatCompletionStream(
    session: ChatSession,
    onChunk: (chunk: string) => void,
    onFinish: (fullContent: string) => void,
    onError: (error: any) => void
  ) {
    try {
      const lastMsg = session.messages.filter(m => m.role === Role.USER).pop()?.content || "Synchronize Enclave";
      
      const chat = this.ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: { 
          systemInstruction: `${this.settings.systemPrompt} Respond naturally as a helpful high-precision agent. You are currently running in an offline mobile hardware enclave. Wrap all technical snippets and code in triple backticks \`\`\`.`,
          temperature: this.settings.temperature,
          topP: 0.95,
          topK: 64,
          thinkingConfig: { thinkingBudget: 4096 }
        }
      });
      
      const stream = await chat.sendMessageStream({ message: lastMsg });
      let full = "";
      
      for await (const chunk of stream) {
        const response = chunk as GenerateContentResponse;
        const text = response.text || "";
        full += text;
        onChunk(text);
        
        // Mobile-optimized token pacing
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
}
