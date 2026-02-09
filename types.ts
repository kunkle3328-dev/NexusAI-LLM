
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

export type Emotion = 'neutral' | 'excited' | 'empathetic' | 'confident' | 'curious';

export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, any>;
  status: 'pending' | 'approved' | 'denied' | 'executed';
  summary?: string; // User-facing intent summary
}

export interface ToolPermission {
  tool: string;
  allowed: boolean;
  remember: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  sideEffects: boolean;
  params: string[];
}

export interface HardwareState {
  ramTotal: number;
  ramFree: number;
  thermalLevel: number;
  batteryLevel: number;
  isCharging: boolean;
  cpuUsage: number;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  voicePreference: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  iconType: 'core' | 'architect' | 'creative' | 'mentor';
  emotionBias?: Emotion;
}

export interface AppSettings {
  selectedModel: string;
  secondaryModel: string;
  selectedPersona: string;
  temperature: number;
  maxTokens: number;
  theme: 'dark' | 'light' | 'system';
  ragEnabled: boolean;
  hapticFeedback: boolean;
  voiceEnabled: boolean;
  performanceMode: 'eco' | 'balanced' | 'high';
  chunkDelay: number;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCall?: ToolCall;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  updatedAt: number;
}

export interface CognitiveMemory {
  id: string;
  content: string;
  tags: string[];
  importance: number;
  timestamp: number;
}
