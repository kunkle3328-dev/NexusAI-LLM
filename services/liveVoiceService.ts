
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Emotion } from '../types';

export class LiveVoiceService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private nextStartTime = 0;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private stream: MediaStream | null = null;
  private currentEmotion: Emotion = 'neutral';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getProsodyAdjustment(emotion: Emotion) {
    switch(emotion) {
      case 'excited': return { playbackRate: 1.15, gain: 1.2 };
      case 'empathetic': return { playbackRate: 0.92, gain: 0.8 };
      case 'confident': return { playbackRate: 1.05, gain: 1.1 };
      case 'curious': return { playbackRate: 1.08, gain: 1.0 };
      default: return { playbackRate: 1.0, gain: 1.0 };
    }
  }

  async start(config: {
    voiceName: string;
    systemInstruction: string;
  }, callbacks: {
    onMessage: (text: string, isUser: boolean) => void;
    onError: (err: any) => void;
    onClose: () => void;
  }) {
    this.stop();

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      callbacks.onError(new Error("Microphone Access Denied"));
      return;
    }

    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          if (!this.inputAudioContext || !this.stream) return;
          const source = this.inputAudioContext.createMediaStreamSource(this.stream);
          this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          this.scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = this.createBlob(inputData);
            this.sessionPromise?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            currentOutputTranscription += text;
            callbacks.onMessage(currentOutputTranscription, false);
            
            // Simple Emotion Inference
            if (text.includes('!') || text.toLowerCase().includes('great')) this.currentEmotion = 'excited';
            else if (text.toLowerCase().includes('sorry')) this.currentEmotion = 'empathetic';
            else this.currentEmotion = 'neutral';

          } else if (message.serverContent?.inputTranscription) {
            currentInputTranscription += message.serverContent.inputTranscription.text;
            callbacks.onMessage(currentInputTranscription, true);
          }

          if (message.serverContent?.turnComplete) {
            currentInputTranscription = '';
            currentOutputTranscription = '';
            this.currentEmotion = 'neutral';
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            const prosody = this.getProsodyAdjustment(this.currentEmotion);
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await this.decodeAudioData(this.decode(base64Audio), this.outputAudioContext, 24000, 1);
            const source = this.outputAudioContext.createBufferSource();
            
            source.buffer = audioBuffer;
            source.playbackRate.value = prosody.playbackRate;
            this.outputNode!.gain.value = prosody.gain;
            
            source.connect(this.outputNode!);
            source.addEventListener('ended', () => this.sources.delete(source));
            source.start(this.nextStartTime);
            this.nextStartTime += (audioBuffer.duration / prosody.playbackRate);
            this.sources.add(source);
          }

          if (message.serverContent?.interrupted) {
            this.sources.forEach(s => { try { s.stop(); } catch(e){} });
            this.sources.clear();
            this.nextStartTime = 0;
            currentOutputTranscription = '';
          }
        },
        onerror: callbacks.onError,
        onclose: callbacks.onClose,
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: config.systemInstruction,
      },
    });
  }

  stop() {
    this.sessionPromise?.then(s => {
      try { s.close(); } catch(e) {}
    });
    
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();

    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    this.sessionPromise = null;
    this.nextStartTime = 0;
    this.currentEmotion = 'neutral';
  }

  private createBlob(data: Float32Array): Blob {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private encode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
    return btoa(binary);
  }

  private decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}
