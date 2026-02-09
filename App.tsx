
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Trash2, Mic, StopCircle, X, Zap, Plus, 
  ChevronDown, Activity, Terminal, Copy, Check, 
  MessageSquare, SlidersHorizontal, Cpu as CpuIcon, 
  Waves, Command, User, Rocket, Target, History,
  AlertCircle, Shield, Brain, HardDrive, Fingerprint,
  Volume2, Layers, Clock, Maximize, Moon, Sun, Monitor
} from 'lucide-react';
import { LLMService } from './services/llmService';
import { LiveVoiceService } from './services/liveVoiceService';
import { StorageService } from './services/storageService';
import { ChatSession, Message, Role, AppSettings, AIState, Persona, ToolCall, ToolPermission } from './types';

const PERSONAS: Persona[] = [
  { 
    id: 'nexus-default', 
    name: 'Nexus Core', 
    description: 'Balanced, professional, and precise.', 
    systemInstruction: 'You are Nexus AI Core. Efficiency and technical precision are paramount.',
    voicePreference: 'Zephyr',
    iconType: 'core'
  },
  { 
    id: 'turing-architect', 
    name: 'Turing Architect', 
    description: 'Expert coder and systems designer.', 
    systemInstruction: 'You are the Turing Architect. Focus on clean code, software patterns, and optimization.',
    voicePreference: 'Fenrir',
    iconType: 'architect'
  },
  { 
    id: 'nova-creative', 
    name: 'Nova Creative', 
    description: 'Friendly, imaginative, and warm.', 
    systemInstruction: 'You are Nova Creative. Be expressive, helpful with brainstorming, and highly conversational.',
    voicePreference: 'Kore',
    iconType: 'creative'
  },
  { 
    id: 'socrates-mentor', 
    name: 'Socrates Mentor', 
    description: 'Philosophical and pedagogical.', 
    systemInstruction: 'You are Socrates Mentor. Guide the user through deep inquiry and logical reasoning.',
    voicePreference: 'Charon',
    iconType: 'mentor'
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'history' | 'config' | 'live'>('chat');
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [aiState, setAiState] = useState<AIState>(AIState.IDLE);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{ text: string, isUser: boolean }[]>([]);
  const [pendingTool, setPendingTool] = useState<{ messageId: string, call: ToolCall } | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nexus_final_dropin_state');
    return saved ? JSON.parse(saved) : {
      selectedModel: 'gemini-3-pro-preview',
      secondaryModel: 'gemini-3-flash-preview',
      selectedPersona: 'nexus-default',
      temperature: 0.7,
      maxTokens: 4096,
      theme: 'dark',
      ragEnabled: true,
      hapticFeedback: true,
      voiceEnabled: true,
      performanceMode: 'balanced',
      chunkDelay: 5,
      voiceName: 'Zephyr'
    };
  });

  const llm = useRef<LLMService | null>(null);
  const liveVoice = useRef<LiveVoiceService | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    llm.current = new LLMService(settings);
    liveVoice.current = new LiveVoiceService();
  }, [settings]);

  useEffect(() => {
    const init = async () => {
      const s = await StorageService.getAllSessions();
      setSessions(s);
      if (s.length > 0) setCurrentId(s[0].id);
      else createNew();
    };
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_final_dropin_state', JSON.stringify(settings));
    
    const applyTheme = () => {
      const isDark = settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    };
    
    applyTheme();
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [settings.theme]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, liveTranscript, view]);

  const vibrate = (s: 'light' | 'medium') => {
    if (settings.hapticFeedback && navigator.vibrate) {
      navigator.vibrate(s === 'light' ? 8 : 25);
    }
  };

  const currentSession = useMemo(() => sessions.find(s => s.id === currentId), [sessions, currentId]);
  const activePersona = useMemo(() => PERSONAS.find(p => p.id === settings.selectedPersona) || PERSONAS[0], [settings.selectedPersona]);

  const toggleLiveMode = async () => {
    if (view === 'live') {
      liveVoice.current?.stop();
      setView('chat');
      setAiState(AIState.IDLE);
      vibrate('medium');
    } else {
      vibrate('medium');
      setView('live');
      setAiState(AIState.LIVE);
      setLiveTranscript([]);
      await liveVoice.current?.start(
        { 
          voiceName: settings.voiceName, 
          systemInstruction: activePersona.systemInstruction 
        },
        {
          onMessage: (text, isUser) => {
            setLiveTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.isUser === isUser) return [...prev.slice(0, -1), { text, isUser }];
              return [...prev, { text, isUser }];
            });

            // Voice-Triggered Tools Detection
            if (isUser && text.length > 5) {
                const intent = llm.current?.classifyVoiceIntent(text);
                if (intent) {
                    vibrate('medium');
                }
            }

            if (!isUser) setAiState(AIState.SPEAKING);
            else setAiState(AIState.LISTENING);
          },
          onError: (e) => {
            console.error(e);
            liveVoice.current?.stop();
            setView('chat');
          },
          onClose: () => {
            liveVoice.current?.stop();
            setView('chat');
          },
        }
      );
    }
  };

  const createNew = async () => {
    vibrate('light');
    const ns: ChatSession = { 
      id: crypto.randomUUID(), 
      title: 'Thread ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      messages: [], 
      modelId: settings.selectedModel, 
      updatedAt: Date.now() 
    };
    setSessions(p => [ns, ...p]);
    setCurrentId(ns.id);
    setView('chat');
    await StorageService.saveSession(ns);
  };

  const onSend = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || isBusy || !currentId || !currentSession) return;

    vibrate('light');
    const um: Message = { id: crypto.randomUUID(), role: Role.USER, content: text, timestamp: Date.now() };
    const am: Message = { id: crypto.randomUUID(), role: Role.ASSISTANT, content: '', timestamp: Date.now(), isStreaming: true };
    
    setSessions(p => p.map(s => s.id === currentId ? { ...s, messages: [...s.messages, um, am], updatedAt: Date.now() } : s));
    setInput('');
    setIsBusy(true);
    setAiState(AIState.THINKING);

    const session = currentSession;
    
    await llm.current?.chatCompletionStream(
      { ...session, messages: [...session.messages, um, am] },
      activePersona.systemInstruction,
      (chunk) => {
        setAiState(AIState.SPEAKING);
        setSessions(p => p.map(s => s.id === currentId ? { ...s, messages: s.messages.map(m => m.id === am.id ? { ...m, content: m.content + chunk } : m) } : s));
      },
      async (final) => {
        setIsBusy(false);
        setAiState(AIState.IDLE);
        
        const toolCall = llm.current?.detectToolCall(final);
        const updatedAm = { ...am, content: final, isStreaming: false, toolCall: toolCall || undefined };
        
        const updatedSess = { ...session, messages: [...session.messages, um, updatedAm], updatedAt: Date.now() };
        setSessions(p => p.map(s => s.id === currentId ? updatedSess : s));
        await StorageService.saveSession(updatedSess);

        if (toolCall) {
          const existingPerm = await StorageService.getToolPermission(toolCall.tool);
          if (existingPerm && existingPerm.remember && existingPerm.allowed) {
              await autoExecuteTool(updatedAm.id, toolCall);
          } else {
              setPendingTool({ messageId: updatedAm.id, call: toolCall });
          }
        }
      },
      () => setIsBusy(false)
    );
  };

  const autoExecuteTool = async (messageId: string, call: ToolCall) => {
    const toolResult = await llm.current?.executeTool(call);
    updateSessionWithToolResult(messageId, call, true, toolResult || "");
  };

  const updateSessionWithToolResult = async (messageId: string, call: ToolCall, approved: boolean, result: string) => {
    if (!currentId || !currentSession) return;
    const updatedMessages = currentSession.messages.map(m => 
        m.id === messageId ? { ...m, toolCall: { ...call, status: approved ? 'executed' : ('denied' as any) }, content: m.content + `\n\n--- TOOL OUTPUT ---\n${result}` } : m
    );
    const updatedSess = { ...currentSession, messages: updatedMessages, updatedAt: Date.now() };
    setSessions(p => p.map(s => s.id === currentId ? updatedSess : s));
    await StorageService.saveSession(updatedSess);
  };

  const handleToolAction = async (approved: boolean, remember: boolean = false) => {
    if (!pendingTool || !currentId || !currentSession) return;
    vibrate('medium');

    const { messageId, call } = pendingTool;
    
    if (remember) {
        await StorageService.saveToolPermission({ tool: call.tool, allowed: approved, remember: true });
    }

    const toolResult = approved ? await llm.current?.executeTool(call) : "NCS: Execution Aborted by User.";
    await updateSessionWithToolResult(messageId, call, approved, toolResult || "");
    setPendingTool(null);
  };

  const renderContent = (m: Message) => {
    const parts = m.content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const langMatch = part.match(/```(\w+)/);
        const language = langMatch ? langMatch[1] : 'code';
        const code = part.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
        return (
          <div key={idx} className="my-2 rounded-xl overflow-hidden bg-[#1B1B1B] w-full border border-white/5">
            <div className="px-3 py-1 flex justify-between items-center bg-black/20">
               <span className="text-[9px] font-black text-[#AAAAAA] uppercase tracking-widest">{language}</span>
               <button 
                 onClick={() => { navigator.clipboard.writeText(code); vibrate('light'); setCopyingId(`${m.id}-${idx}`); setTimeout(() => setCopyingId(null), 2000); }} 
                 className="p-1 hover:bg-white/5 rounded transition-all text-[#AAAAAA]"
               >
                 {copyingId === `${m.id}-${idx}` ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
               </button>
            </div>
            <div className="p-3 overflow-x-auto hide-scrollbar">
              <pre className="text-[11px] leading-relaxed mono text-[#C5C8C6] whitespace-pre-wrap">{code}</pre>
            </div>
          </div>
        );
      }
      
      const lines = part.split('\n').map((line, lIdx) => {
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return <div key={lIdx} className="pl-4 py-0.5">• {line.trim().substring(2)}</div>;
        }
        return <div key={lIdx}>{line}</div>;
      });

      return <div key={idx} className="whitespace-pre-wrap text-[15px] leading-relaxed py-0.5">{lines}</div>;
    });
  };

  return (
    <div className="app-container bg-[#121212] flex flex-col h-screen text-[#FFFFFF] overflow-hidden">
      <div className="h-[env(safe-area-inset-top)]" />

      {/* TOP: Header */}
      <div className="px-4 py-2 flex items-center justify-between z-50 glass border-b border-white/5">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl">
              <Zap size={18} fill="white" />
           </div>
           <div>
              <div className="text-[12px] font-black uppercase tracking-tighter leading-none">Nexus Enclave</div>
              <div className="text-[8px] font-bold text-green-500 uppercase tracking-widest mt-0.5">Isolated • Secure</div>
           </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('chat')} className={`p-2 rounded-lg transition-all ${view === 'chat' ? 'bg-blue-600/20 text-blue-500' : 'text-[#AAAAAA]'}`}><MessageSquare size={18} /></button>
          <button onClick={() => setView('history')} className={`p-2 rounded-lg transition-all ${view === 'history' ? 'bg-blue-600/20 text-blue-500' : 'text-[#AAAAAA]'}`}><History size={18} /></button>
          <button onClick={() => setView('config')} className={`p-2 rounded-lg transition-all ${view === 'config' ? 'bg-blue-600/20 text-blue-500' : 'text-[#AAAAAA]'}`}><SlidersHorizontal size={18} /></button>
        </div>
      </div>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {view === 'live' ? (
          <div className="h-full bg-black flex flex-col items-center justify-between p-8 animate-[fadeIn_0.5s_ease]">
             <div className="w-full flex justify-between">
                <button onClick={() => setView('chat')} className="p-3 bg-white/5 rounded-xl text-white/40"><X size={20} /></button>
             </div>
             
             <div className="flex flex-col items-center gap-10">
                <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 relative ${aiState === AIState.SPEAKING ? 'scale-110 shadow-[0_0_80px_rgba(129,199,132,0.4)]' : 'scale-100 shadow-[0_0_30px_rgba(76,175,80,0.2)]'}`}>
                   <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${aiState === AIState.SPEAKING ? 'bg-gradient-to-r from-[#81C784] to-[#4CAF50] animate-pulse' : 'bg-[#4CAF50]'}`}></div>
                   <Waves size={64} className={`relative z-10 text-white ${aiState === AIState.SPEAKING ? 'animate-bounce' : 'animate-pulse'}`} />
                </div>
                <div className="text-center">
                   <h2 className="text-xl font-black tracking-widest uppercase mb-1">{activePersona.name}</h2>
                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.4em]">{aiState === AIState.LISTENING ? 'Listening...' : aiState === AIState.SPEAKING ? 'Speaking...' : 'Ready'}</p>
                </div>
             </div>

             <div className="w-full max-w-xs bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/5 h-40 overflow-y-auto hide-scrollbar flex flex-col justify-end">
                {liveTranscript.slice(-3).map((t, i) => (
                  <div key={i} className={`text-sm mb-2 font-bold leading-snug animate-[fadeIn_0.3s_ease] ${t.isUser ? 'text-white/30' : 'text-white'}`}>{t.text}</div>
                ))}
             </div>

             <button onClick={toggleLiveMode} className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-2xl active:scale-95 transition-all mb-4">
                <StopCircle size={32} />
             </button>
          </div>
        ) : view === 'history' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#AAAAAA]">Signal History</h3>
                <button onClick={createNew} className="p-2 bg-blue-600 text-white rounded-lg"><Plus size={16} /></button>
             </div>
             {sessions.map(s => (
              <button key={s.id} onClick={() => { setCurrentId(s.id); setView('chat'); vibrate('light'); }} className={`w-full p-4 rounded-xl border text-left transition-all ${s.id === currentId ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#1E1E1E] border-white/5 text-[#AAAAAA]'}`}>
                <div className="font-bold text-sm mb-1 truncate">{s.title || "Unknown Fragment"}</div>
                <div className="text-[8px] uppercase tracking-widest opacity-60">{new Date(s.updatedAt).toLocaleDateString()} • {s.messages.length} signals</div>
              </button>
             ))}
          </div>
        ) : view === 'config' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-24 hide-scrollbar bg-[#121212]">
             
             {/* ENCLAVE PERSONA */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 text-blue-500 px-1">
                   <User size={16} strokeWidth={3} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Enclave Persona</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   {PERSONAS.map(p => (
                     <button 
                       key={p.id} 
                       onClick={() => { vibrate('medium'); setSettings(s => ({ ...s, selectedPersona: p.id, voiceName: p.voicePreference })); }}
                       className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between h-32 relative overflow-hidden ${settings.selectedPersona === p.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-[#1E1E1E] border-white/5 text-[#AAAAAA] hover:border-blue-500/20'}`}
                     >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${settings.selectedPersona === p.id ? 'bg-white/10' : 'bg-black/20'}`}>
                           {p.id === 'nexus-default' ? <Command size={18}/> : p.id === 'turing-architect' ? <CpuIcon size={18}/> : p.id === 'nova-creative' ? <Rocket size={18}/> : <Target size={18}/>}
                        </div>
                        <div>
                           <div className="font-black text-[11px] uppercase tracking-tighter mb-0.5 leading-none">{p.name}</div>
                           <div className={`text-[8px] font-medium leading-tight line-clamp-2 ${settings.selectedPersona === p.id ? 'text-blue-100' : 'text-white/30'}`}>{p.description}</div>
                        </div>
                     </button>
                   ))}
                </div>
             </section>

             {/* HARDWARE STACK */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 text-amber-500 px-1">
                   <HardDrive size={16} strokeWidth={3} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Hardware Stack</h3>
                </div>
                <div className="p-5 bg-[#1E1E1E] rounded-3xl border border-white/5 space-y-6 shadow-sm">
                   <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/30 block">Primary Core</label>
                      <div className="relative">
                        <select 
                          value={settings.selectedModel} 
                          onChange={(e) => setSettings(p => ({ ...p, selectedModel: e.target.value }))}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[13px] font-bold appearance-none outline-none text-white transition-all focus:border-blue-500/50"
                        >
                           <option value="gemini-3-pro-preview">Llama-3-8B (Enclave)</option>
                           <option value="gemini-3-flash-preview">Phi-3-Mini (Fast)</option>
                           <option value="gemini-2.5-flash-image">Nexus Vision</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30"><ChevronDown size={16}/></div>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/30 block">Secondary Hot-Swap</label>
                      <div className="relative">
                        <select 
                          value={settings.secondaryModel} 
                          onChange={(e) => setSettings(p => ({ ...p, secondaryModel: e.target.value }))}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[13px] font-bold appearance-none outline-none text-white transition-all focus:border-blue-500/50"
                        >
                           <option value="gemini-3-flash-preview">Phi-3-Mini (Default)</option>
                           <option value="gemini-3-pro-preview">Llama-3-8B (High Performance)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30"><ChevronDown size={16}/></div>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-white/30 block">Voice Synthesizer</label>
                      <div className="relative">
                        <select 
                          value={settings.voiceName} 
                          onChange={(e) => setSettings(p => ({ ...p, voiceName: e.target.value as any }))}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[13px] font-bold appearance-none outline-none text-white transition-all focus:border-blue-500/50"
                        >
                           <option value="Zephyr">Zephyr (Default)</option>
                           <option value="Kore">Kore (Friendly)</option>
                           <option value="Fenrir">Fenrir (Professional)</option>
                           <option value="Puck">Puck (Energetic)</option>
                           <option value="Charon">Charon (Calm)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30"><ChevronDown size={16}/></div>
                      </div>
                   </div>
                </div>
             </section>

             {/* SYNAPSE TUNING */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 text-purple-500 px-1">
                   <SlidersHorizontal size={16} strokeWidth={3} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Synapse Tuning</h3>
                </div>
                <div className="p-5 bg-[#1E1E1E] rounded-3xl border border-white/5 space-y-8 shadow-sm">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Entropy (Temp)</span>
                        <span className="text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md text-[10px]">{settings.temperature.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05" value={settings.temperature} onChange={(e) => setSettings(p => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full h-1 bg-black rounded-full appearance-none accent-blue-600" />
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <Maximize size={12} className="text-white/30" />
                           <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Context Horizon</span>
                        </div>
                        <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md text-[10px]">{settings.maxTokens} tkn</span>
                      </div>
                      <input type="range" min="256" max="8192" step="128" value={settings.maxTokens} onChange={(e) => setSettings(p => ({ ...p, maxTokens: parseInt(e.target.value) }))} className="w-full h-1 bg-black rounded-full appearance-none accent-amber-500" />
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <Clock size={12} className="text-white/30" />
                           <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Inference Pacing</span>
                        </div>
                        <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-md text-[10px]">{settings.chunkDelay}ms</span>
                      </div>
                      <input type="range" min="0" max="100" step="1" value={settings.chunkDelay} onChange={(e) => setSettings(p => ({ ...p, chunkDelay: parseInt(e.target.value) }))} className="w-full h-1 bg-black rounded-full appearance-none accent-green-500" />
                   </div>

                   <div className="grid grid-cols-3 gap-2 pt-2">
                      {['eco', 'balanced', 'high'].map(m => (
                        <button key={m} onClick={() => { vibrate('light'); setSettings(p => ({ ...p, performanceMode: m as any })); }} className={`py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${settings.performanceMode === m ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-black/30 border-white/5 text-[#AAAAAA]'}`}>
                           {m}
                        </button>
                      ))}
                   </div>
                </div>
             </section>

             {/* NEURAL NODES */}
             <section className="space-y-3">
                <div className="flex items-center gap-2 text-green-500 px-1">
                   <Layers size={16} strokeWidth={3} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Nodes</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Tactile Haptics', key: 'hapticFeedback' as const, icon: Fingerprint, color: 'text-amber-500' },
                    { label: 'Cognitive Memory', key: 'ragEnabled' as const, icon: Brain, color: 'text-green-500' },
                    { label: 'Duplex Voice', key: 'voiceEnabled' as const, icon: Volume2, color: 'text-blue-500' }
                  ].map(item => (
                    <div key={item.key} className="flex justify-between items-center p-4 bg-[#1E1E1E] rounded-2xl border border-white/5 shadow-sm transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                         <div className={`w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center ${item.color}`}><item.icon size={18} strokeWidth={2.5} /></div>
                         <span className="text-[14px] font-bold tracking-tight text-white">{item.label}</span>
                      </div>
                      <button onClick={() => { vibrate('light'); setSettings(p => ({ ...p, [item.key]: !p[item.key as keyof AppSettings] })); }} className={`w-10 h-6 rounded-full p-1 transition-all flex items-center ${settings[item.key as keyof AppSettings] ? 'bg-blue-600' : 'bg-black/40'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings[item.key as keyof AppSettings] ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
             </section>

             {/* SYSTEM INTERFACE */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 px-1">
                   <Monitor size={16} strokeWidth={3} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">System Interface</h3>
                </div>
                <div className="p-5 bg-[#1E1E1E] rounded-3xl border border-white/5 space-y-4 shadow-sm">
                   <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30 block mb-2">Visual Mode</span>
                      <div className="flex bg-black/30 rounded-xl p-1 gap-1">
                        {[
                          { val: 'light', icon: Sun },
                          { val: 'dark', icon: Moon },
                          { val: 'system', icon: Monitor }
                        ].map(t => (
                          <button 
                            key={t.val} 
                            onClick={() => { vibrate('light'); setSettings(s => ({ ...s, theme: t.val as any })); }}
                            className={`p-2 rounded-lg transition-all ${settings.theme === t.val ? 'bg-blue-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
                          >
                            <t.icon size={16} />
                          </button>
                        ))}
                      </div>
                   </div>
                </div>
             </section>

             <div className="p-8 text-center space-y-4 opacity-40">
                <div className="space-y-1">
                   <div className="text-[10px] text-blue-500 font-black uppercase tracking-[0.6em]">Nexus Enclave</div>
                   <div className="text-[8px] text-white font-bold uppercase tracking-widest">v4.4.2-final • ARM64 Neon Ready</div>
                </div>
                <div className="text-[7px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                   Neural compute isolated within device-bound sandboxed runtime.<br/>
                   End-to-end local encryption active.
                </div>
             </div>
          </div>
        ) : (
          <div className="h-full flex flex-col relative">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 hide-scrollbar">
              {(!currentSession || currentSession.messages.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                   <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-2xl relative" onClick={toggleLiveMode}>
                      <Zap size={36} fill="white" />
                   </div>
                   <div className="space-y-1">
                     <h2 className="text-xl font-black uppercase tracking-widest">Enclave Initialized</h2>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#AAAAAA]">Neural Core v4.4.0 • Isolated Mode</p>
                   </div>
                   <div className="grid grid-cols-2 gap-2 w-full max-w-[240px]">
                      {["Diagnostics", "Search File", "Memory Sync", "NCS Status"].map(t => (
                        <button key={t} onClick={() => onSend(t)} className="px-3 py-2.5 bg-[#1E1E1E] border border-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-[#AAAAAA] active:scale-95">{t}</button>
                      ))}
                   </div>
                </div>
              ) : (
                currentSession.messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.role === Role.USER ? 'items-end' : 'items-start'} animate-[fadeIn_0.3s_ease]`}>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[88%] ${m.role === Role.USER ? 'bg-[#3E3E3E] text-white rounded-br-none' : 'bg-[#2E2E2E] text-white rounded-bl-none border border-white/5 shadow-md'}`}>
                      {renderContent(m)}
                    </div>
                    {m.toolCall && m.toolCall.status === 'pending' && (
                      <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl max-w-[88%] flex flex-col gap-2">
                         <div className="flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest">
                            <Shield size={14} /> TOOL PERMISSION REQUEST
                         </div>
                         <div className="text-[12px] font-bold text-gray-300">
                            Nexus wants to: <span className="text-white font-bold">{m.toolCall.summary || m.toolCall.tool}</span>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => handleToolAction(true)} className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold uppercase">Approve</button>
                            <button onClick={() => handleToolAction(false)} className="flex-1 py-1.5 bg-red-600/20 text-red-500 border border-red-500/30 rounded-lg text-[10px] font-bold uppercase">Deny</button>
                         </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messageEndRef} className="h-4" />
            </div>

            {/* INPUT ROW */}
            <div className="px-3 py-3 glass border-t border-white/5 flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
               <div className="flex-1 flex items-center bg-[#1E1E1E] rounded-xl px-4 py-1.5 border border-white/5 focus-within:border-blue-500/50 transition-all">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()} placeholder="Awaiting Input..." className="flex-1 bg-transparent border-none outline-none py-2 text-[14px] text-white placeholder:text-[#555] placeholder:uppercase placeholder:text-[9px] placeholder:tracking-widest" />
                  {isBusy ? (
                    <button onClick={() => llm.current?.sendControlSignal('INTERRUPT')} className="p-1 text-red-500 animate-pulse"><StopCircle size={20} /></button>
                  ) : (
                    <button onClick={() => onSend()} disabled={!input.trim()} className="p-1 text-blue-500 disabled:opacity-20 active:scale-75 transition-transform"><Send size={20} /></button>
                  )}
               </div>
               <button onClick={toggleLiveMode} className="w-11 h-11 bg-[#4CAF50] text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-all">
                  <Mic size={22} strokeWidth={2.5} />
               </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input:focus { outline: none; }
        .glass { background: rgba(18, 18, 18, 0.98); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
        .dark .glass { background: rgba(13, 13, 13, 0.98); }
        
        /* Custom range styling for mobile */
        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          margin-top: -8.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 3px;
          cursor: pointer;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default App;
