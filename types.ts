
export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export enum AIState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  LIVE = 'LIVE'
}

export interface HardwareState {
  ramTotal: number;
  ramFree: number;
  thermalLevel: number;
  batteryLevel: number;
  isCharging: boolean;
  cpuUsage: number;
}

export interface AppSettings {
  selectedModel: string;
  secondaryModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  theme: 'light' | 'dark' | 'system';
  ragEnabled: boolean;
  hapticFeedback: boolean;
  voiceEnabled: boolean;
  performanceMode: 'eco' | 'balanced' | 'high';
  chunkDelay: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  updatedAt: number;
}

// Added CognitiveMemory interface for memory persistence and RAG
export interface CognitiveMemory {
  id: string;
  content: string;
  tags: string[];
  importance: number;
  timestamp: number;
}
