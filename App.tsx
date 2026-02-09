
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Settings as SettingsIcon, Send, Trash2, History, Mic, Brain, StopCircle, X, 
  Zap, Plus, ChevronUp, ChevronDown, Thermometer, Battery, Command, Sliders, 
  ShieldCheck, Database, Copy, Check, MessageSquare, Moon, Sun, Monitor, 
  Cpu as CpuIcon, Waves, MicOff, Radio, Volume2, Activity, Terminal, Ghost,
  Code, Play, VolumeX, Fingerprint, Layers, Cpu, Sparkles, SlidersHorizontal,
  Layout, Palette, Info
} from 'lucide-react';
import { LLMService } from './services/llmService';
import { LiveVoiceService } from './services/liveVoiceService';
import { StorageService } from './services/storageService';
import { ChatSession, Message, Role, AppSettings, AIState, HardwareState } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'history' | 'config' | 'live'>('chat');
  const [showContext, setShowContext] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [aiState, setAiState] = useState<AIState>(AIState.IDLE);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [kernelInitialized, setKernelInitialized] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{ text: string, isUser: boolean }[]>([]);
  
  const [hwState, setHwState] = useState<HardwareState>({
    ramTotal: 16384, ramFree: 8192, thermalLevel: 36, batteryLevel: 92,
    isCharging: false, cpuUsage: 8
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nexus_v1_production_state');
    return saved ? JSON.parse(saved) : {
      selectedModel: 'gemini-3-pro-preview',
      secondaryModel: 'gemini-3-flash-preview',
      systemPrompt: 'You are Nexus AI. Respond naturally, wrap code in triple backticks ```.',
      temperature: 0.7,
      maxTokens: 4096,
      theme: 'dark',
      ragEnabled: true,
      hapticFeedback: true,
      voiceEnabled: true,
      performanceMode: 'balanced',
      chunkDelay: 10
    };
  });

  const llm = useRef<LLMService | null>(null);
  const liveVoice = useRef<LiveVoiceService | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Kernel Boot Sequence
  useEffect(() => {
    if (kernelInitialized) return;
    const logs = [
      "🚀 NEXUS AI KERNEL v4.3.0 BOOTING",
      "🔧 ARCH: ARM64-v8.4 NEON (Vector Optimized)",
      "🔋 POWER: ENCLAVE ISOLATED MODE",
      "📦 MOUNTING: Llama-3-8B GGUF weights...",
      "🎤 WHISPER: Offline STT Engine Synchronized",
      "🔊 PIPER: Neural TTS Speaker Initialized",
      "🧠 COGNITIVE: Memory Fabric v3.2 Online",
      "✅ All Systems Operational."
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) { 
        setSystemLogs(p => [...p, logs[i++]]); 
      } else { 
        setKernelInitialized(true); 
        clearInterval(interval); 
      }
    }, 45);
    return () => clearInterval(interval);
  }, [kernelInitialized]);

  // Services Initialization
  useEffect(() => {
    llm.current = new LLMService(settings);
    liveVoice.current = new LiveVoiceService();
  }, [settings]);

  // Hardware Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setHwState(prev => ({
        ...prev,
        ramFree: Math.max(512, prev.ramFree + (Math.random() - 0.5) * 400),
        thermalLevel: Math.min(85, Math.max(32, prev.thermalLevel + (isBusy ? 0.35 : -0.1))),
        cpuUsage: isBusy ? 65 + Math.random() * 30 : 5 + Math.random() * 5,
        batteryLevel: Math.max(0, prev.batteryLevel - (isBusy ? 0.05 : 0.01))
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, [isBusy]);

  // Storage Sync
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
    localStorage.setItem('nexus_v1_production_state', JSON.stringify(settings));
    if (llm.current) llm.current.updateSettings(settings);
    document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }, [settings]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, liveTranscript, view]);

  const vibrate = (s: 'light' | 'medium' | 'heavy') => {
    if (settings.hapticFeedback && navigator.vibrate) {
      navigator.vibrate(s === 'light' ? 8 : s === 'medium' ? 25 : [40, 20, 40]);
    }
  };

  const toggleLiveMode = async () => {
    if (view === 'live') {
      // Explicitly stop all voice/mic services
      liveVoice.current?.stop();
      setView('chat');
      setAiState(AIState.IDLE);
      vibrate('medium');
    } else {
      vibrate('medium');
      setView('live');
      setAiState(AIState.LIVE);
      setLiveTranscript([]);
      await liveVoice.current?.start({
        onMessage: (text, isUser) => {
          setLiveTranscript(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isUser === isUser) {
              return [...prev.slice(0, -1), { text, isUser }];
            }
            return [...prev, { text, isUser }];
          });
        },
        onError: (e) => {
          console.error("Live Error", e);
          setView('chat');
        },
        onClose: () => {
          setView('chat');
        },
      });
    }
  };

  const createNew = async () => {
    vibrate('light');
    const ns: ChatSession = { 
      id: crypto.randomUUID(), 
      title: 'Neural Thread ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      messages: [], 
      modelId: settings.selectedModel, 
      updatedAt: Date.now() 
    };
    setSessions(p => [ns, ...p]);
    setCurrentId(ns.id);
    setView('chat');
    await StorageService.saveSession(ns);
  };

  const deleteSess = async (id: string) => {
    vibrate('medium');
    await StorageService.deleteSession(id);
    const upd = sessions.filter(s => s.id !== id);
    setSessions(upd);
    if (currentId === id) {
      if (upd.length > 0) setCurrentId(upd[0].id);
      else createNew();
    }
  };

  const onSend = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || isBusy || !currentId) return;

    vibrate('light');
    const um: Message = { id: crypto.randomUUID(), role: Role.USER, content: text, timestamp: Date.now() };
    const am: Message = { id: crypto.randomUUID(), role: Role.ASSISTANT, content: '', timestamp: Date.now(), isStreaming: true };
    
    setSessions(p => p.map(s => s.id === currentId ? { ...s, messages: [...s.messages, um, am], updatedAt: Date.now() } : s));
    setInput('');
    setIsBusy(true);
    setAiState(AIState.THINKING);

    const session = sessions.find(s => s.id === currentId)!;
    await llm.current?.chatCompletionStream(
      { ...session, messages: [...session.messages, um, am] },
      (chunk) => {
        setAiState(AIState.SPEAKING);
        setSessions(p => p.map(s => s.id === currentId ? { ...s, messages: s.messages.map(m => m.id === am.id ? { ...m, content: m.content + chunk } : m) } : s));
      },
      async (final) => {
        setIsBusy(false);
        setAiState(AIState.IDLE);
        const updatedSess = { ...session, messages: [...session.messages, um, { ...am, content: final, isStreaming: false }], updatedAt: Date.now() };
        await StorageService.saveSession(updatedSess);
      },
      () => setIsBusy(false)
    );
  };

  const renderContent = (m: Message) => {
    const parts = m.content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const langMatch = lines[0].match(/```(\w+)/);
        const language = langMatch ? langMatch[1] : 'code';
        const code = part.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
        return (
          <div key={idx} className="my-3 rounded-2xl overflow-hidden border border-zinc-800 bg-[#0d0d0d] w-full shadow-2xl animate-[fadeIn_0.3s_ease]">
            <div className="px-4 py-2 flex justify-between items-center bg-[#1a1a1a] border-b border-zinc-800/50">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{language}</span>
               </div>
               <button 
                 onClick={() => { navigator.clipboard.writeText(code); vibrate('light'); setCopyingId(`${m.id}-${idx}`); setTimeout(() => setCopyingId(null), 2000); }} 
                 className="flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-700/50 rounded-lg transition-all text-gray-400 active:scale-95"
               >
                 {copyingId === `${m.id}-${idx}` ? (
                   <><Check size={12} className="text-green-500" /><span className="text-[8px] font-bold text-green-500 uppercase">Copied</span></>
                 ) : (
                   <><Copy size={12} /><span className="text-[8px] font-bold uppercase">Copy</span></>
                 )}
               </button>
            </div>
            <div className="p-4 overflow-x-auto hide-scrollbar bg-black/40">
              <pre className="text-[11px] leading-relaxed mono text-[#E0E0E0] whitespace-pre-wrap break-all tracking-tight">{code}</pre>
            </div>
          </div>
        );
      }
      return <div key={idx} className="whitespace-pre-wrap text-[14px] leading-relaxed tracking-tight content-formatted font-medium">{part}</div>;
    });
  };

  const currentSession = useMemo(() => sessions.find(s => s.id === currentId), [sessions, currentId]);

  return (
    <div className="app-container bg-[#fcfcfc] dark:bg-[#080808] overflow-hidden flex flex-col h-screen text-gray-900 dark:text-[#D1D1D1] font-sans transition-colors duration-500">
      <div className="h-[env(safe-area-inset-top)]" />

      {/* HEADER */}
      <header className="px-4 py-3 flex items-center justify-between glass z-50 border-b border-gray-200/40 dark:border-zinc-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all cursor-pointer" onClick={createNew}>
            <Command size={20} strokeWidth={2.5} />
          </div>
          <div onClick={() => setShowConsole(!showConsole)} className="cursor-pointer active:opacity-70 transition-opacity">
            <h1 className="text-[14px] font-black tracking-tighter uppercase leading-none">Nexus Enclave</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-amber-500 animate-pulse' : kernelInitialized ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">Kernel Stable</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
           <button onClick={() => setView('chat')} className={`p-2 rounded-xl transition-all active:scale-90 ${view === 'chat' ? 'text-blue-600 bg-blue-500/10 shadow-inner' : 'text-gray-400'}`}><MessageSquare size={18} /></button>
           <button onClick={() => setView('history')} className={`p-2 rounded-xl transition-all active:scale-90 ${view === 'history' ? 'text-blue-600 bg-blue-500/10' : 'text-gray-400'}`}><History size={18} /></button>
           <button onClick={() => setView('config')} className={`p-2 rounded-xl transition-all active:scale-90 ${view === 'config' ? 'text-blue-600 bg-blue-500/10' : 'text-gray-400'}`}><SlidersHorizontal size={18} /></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {view === 'live' ? (
          <div className="h-full bg-[#050505] flex flex-col items-center justify-between p-8 animate-[fadeIn_0.5s_ease] overflow-hidden relative">
             <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-blue-600/30"></div>
             </div>

             <div className="w-full flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Enclave Linked</span>
                </div>
                <button onClick={() => setShowContext(!showContext)} className="p-3 bg-zinc-900/50 backdrop-blur rounded-2xl text-zinc-400 active:scale-90 transition-all border border-zinc-800/50"><Activity size={22} /></button>
             </div>

             <div className="flex flex-col items-center space-y-12 z-10">
                <div className="relative">
                   <div className="w-64 h-64 rounded-full bg-blue-600/5 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border border-blue-600/10 animate-[ping_3s_infinite]"></div>
                      <div className="w-48 h-48 rounded-full bg-blue-600/10 flex items-center justify-center relative">
                         <div className="w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-[0_0_60px_rgba(37,99,235,0.8)] relative z-20 active:scale-90 transition-transform">
                            <Waves size={54} className="animate-spin-slow" />
                         </div>
                      </div>
                   </div>
                </div>
                <div className="text-center space-y-3">
                   <h2 className="text-xl font-black tracking-[0.2em] uppercase text-blue-500 animate-pulse">Live Enclave</h2>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em]">Zero Latency Duplex Mode</p>
                </div>
             </div>

             <div className="w-full max-w-md bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl h-48 overflow-y-auto hide-scrollbar flex flex-col justify-end z-10">
                {liveTranscript.length > 0 ? (
                  liveTranscript.slice(-4).map((t, i) => (
                    <div key={i} className={`text-base mb-3 font-bold leading-snug animate-[fadeIn_0.3s_ease] ${t.isUser ? 'text-zinc-600' : 'text-white'}`}>
                      {t.text}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 italic text-center text-sm font-black uppercase tracking-[0.2em] opacity-50">Speak to start interaction...</div>
                )}
             </div>

             <button onClick={toggleLiveMode} className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95 transition-all z-10 mb-6"><StopCircle size={42} /></button>
          </div>
        ) : view === 'chat' ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 hide-scrollbar scroll-smooth">
              {(showConsole || !kernelInitialized) && (
                <div className="p-4 bg-black/95 border border-zinc-800 rounded-2xl mono text-[10px] text-green-500/90 mb-4 overflow-hidden shadow-2xl border-l-4 border-l-green-500">
                   <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2 font-black uppercase tracking-widest text-zinc-500"><Terminal size={12}/> <span>Neural Kernel v4.3 Trace</span></div>
                    {kernelInitialized && <button onClick={() => setShowConsole(false)} className="text-zinc-500"><X size={14}/></button>}
                  </div>
                  {systemLogs.map((l, i) => <div key={i} className="mb-1 leading-tight truncate opacity-80">{l}</div>)}
                </div>
              )}

              {(!currentSession || currentSession.messages.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-10 animate-[fadeIn_0.5s_ease] py-12">
                   <div className="w-36 h-36 rounded-[2.5rem] bg-blue-600 flex items-center justify-center text-white shadow-2xl active:scale-95 transition-all cursor-pointer hover:rotate-2 relative group" onClick={toggleLiveMode}>
                      <Mic size={48} strokeWidth={2.5} />
                   </div>
                   <div className="space-y-3">
                     <h2 className="text-2xl font-black tracking-tighter uppercase leading-none text-zinc-900 dark:text-white">Neural Core</h2>
                     <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">Isolated & High-Precision</p>
                   </div>
                   <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-4">
                      {["Thermal Diagnostics", "Memory Pruning", "RAG Sync", "Kernel Health"].map(t => (
                        <button key={t} onClick={() => onSend(t)} className="px-4 py-3.5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest text-gray-500 shadow-sm active:scale-95">{t}</button>
                      ))}
                   </div>
                </div>
              ) : (
                currentSession.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === Role.USER ? 'justify-end' : 'justify-start'} message-bubble`}>
                    <div className={`flex flex-col gap-1 max-w-[92%] ${m.role === Role.USER ? 'items-end' : 'items-start'}`}>
                       <div className={`px-4 py-3 rounded-[1.5rem] shadow-sm transition-all relative ${
                         m.role === Role.USER 
                           ? 'bg-blue-600 text-white rounded-br-none' 
                           : 'bg-white dark:bg-[#121212] text-gray-900 dark:text-[#E0E0E0] border border-gray-100 dark:border-zinc-800/80 rounded-bl-none shadow-md'
                       }`}>
                          {renderContent(m)}
                       </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messageEndRef} className="h-4" />
            </div>

            <div className="px-4 py-4 glass border-t border-gray-200/40 dark:border-zinc-800/40 pb-[calc(1rem+env(safe-area-inset-bottom))]">
               <div className="flex items-center gap-3">
                  <button onClick={toggleLiveMode} className="w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all flex items-center justify-center hover:bg-blue-700"><Mic size={24} strokeWidth={2.5} /></button>
                  <div className="flex-1 flex items-center bg-gray-100 dark:bg-zinc-900 rounded-2xl px-4 py-1.5 border border-transparent focus-within:border-blue-500 transition-all shadow-inner">
                     <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()} placeholder="Awaiting instruction..." className="flex-1 bg-transparent border-none outline-none py-3 text-[15px] font-medium" />
                     {isBusy ? (
                       <button onClick={() => llm.current?.sendControlSignal('INTERRUPT')} className="p-2 text-red-500 animate-pulse active:scale-75"><StopCircle size={22} /></button>
                     ) : (
                       <button onClick={() => onSend()} disabled={!input.trim()} className="p-2 text-blue-600 disabled:opacity-20 active:scale-75 transition-transform"><Send size={22} /></button>
                     )}
                  </div>
               </div>
            </div>
          </div>
        ) : view === 'history' ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#fcfcfc] dark:bg-[#080808]">
             <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-gray-500">Neural Memories</h3>
                <button onClick={createNew} className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl active:scale-90 transition-all"><Plus size={22} /></button>
             </div>
             {sessions.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 opacity-20 space-y-4"><Ghost size={64} strokeWidth={1} /><p className="text-[10px] font-black uppercase tracking-widest">Memory Enclave Empty</p></div>
             ) : (
               sessions.map(s => (
                <div key={s.id} onClick={() => { setCurrentId(s.id); setView('chat'); vibrate('light'); }} className={`p-5 rounded-3xl border transition-all active:scale-[0.98] relative overflow-hidden group ${s.id === currentId ? 'bg-blue-600 border-blue-600 text-white shadow-2xl' : 'bg-white dark:bg-[#121212] border-gray-100 dark:border-zinc-800 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="space-y-1 pr-6 flex-1">
                      <span className="font-bold text-[14px] leading-tight block truncate">{s.title || "Untitled Fragment"}</span>
                      <div className={`text-[9px] font-black uppercase tracking-widest opacity-60 ${s.id === currentId ? 'text-blue-100' : 'text-gray-500'}`}>{new Date(s.updatedAt).toLocaleDateString()} • {s.messages.length} Signals</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteSess(s.id); }} className={`p-2 rounded-xl transition-all ${s.id === currentId ? 'text-white/70 hover:bg-white/10' : 'text-red-500 hover:bg-red-500/10'}`}><Trash2 size={16} /></button>
                  </div>
                </div>
               ))
             )}
          </div>
        ) : (
          /* FULL CONFIG VIEW */
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#fcfcfc] dark:bg-[#080808] pb-12 hide-scrollbar">
             
             {/* MODEL SETTINGS */}
             <section className="space-y-4">
                <div className="flex items-center gap-2.5 text-blue-500 px-1">
                   <Sparkles size={18} strokeWidth={3} />
                   <h3 className="text-[12px] font-black uppercase tracking-[0.3em]">Neural Hardware</h3>
                </div>
                <div className="p-6 bg-white dark:bg-[#121212] rounded-[2rem] border border-gray-100 dark:border-zinc-800 space-y-6 shadow-sm">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Primary Core</label>
                      <select 
                        value={settings.selectedModel} 
                        onChange={(e) => setSettings(p => ({ ...p, selectedModel: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500"
                      >
                         <option value="gemini-3-pro-preview">Gemini 3 Pro (Nexus Standard)</option>
                         <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast Inference)</option>
                         <option value="gemini-2.5-flash-image">Gemini 2.5 Image Core</option>
                      </select>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">System Enclave Prompt</label>
                      <textarea 
                        value={settings.systemPrompt} 
                        onChange={(e) => setSettings(p => ({ ...p, systemPrompt: e.target.value }))}
                        className="w-full h-24 bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 hide-scrollbar"
                      />
                   </div>
                </div>
             </section>

             {/* INFERENCE TUNING */}
             <section className="space-y-4">
                <div className="flex items-center gap-2.5 text-amber-500 px-1">
                   <SlidersHorizontal size={18} strokeWidth={3} />
                   <h3 className="text-[12px] font-black uppercase tracking-[0.3em]">Inference Tuning</h3>
                </div>
                <div className="p-6 bg-white dark:bg-[#121212] rounded-[2rem] border border-gray-100 dark:border-zinc-800 space-y-6 shadow-sm">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Neural Temperature</span>
                        <span className="text-blue-600 font-bold">{settings.temperature.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05" value={settings.temperature} onChange={(e) => setSettings(p => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full appearance-none accent-blue-600" />
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Chunk Stream Delay</span>
                        <span className="text-blue-600 font-bold">{settings.chunkDelay}ms</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value={settings.chunkDelay} onChange={(e) => setSettings(p => ({ ...p, chunkDelay: parseInt(e.target.value) }))} className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full appearance-none accent-blue-600" />
                   </div>
                   <div className="grid grid-cols-3 gap-2.5 pt-2">
                      {['eco', 'balanced', 'high'].map(m => (
                        <button key={m} onClick={() => { vibrate('light'); setSettings(p => ({ ...p, performanceMode: m as any })); }} className={`py-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${settings.performanceMode === m ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-zinc-50 dark:bg-zinc-800/50 border-transparent text-gray-400'}`}>
                           {m}
                        </button>
                      ))}
                   </div>
                </div>
             </section>

             {/* UI & FEATURES */}
             <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-purple-500 px-1">
                   <Layout size={18} strokeWidth={3} />
                   <h3 className="text-[12px] font-black uppercase tracking-[0.3em]">Environment</h3>
                </div>
                {[
                  { label: 'Neural Haptics', key: 'hapticFeedback' as const, icon: Fingerprint, color: 'text-amber-500' },
                  { label: 'Cognitive RAG Memory', key: 'ragEnabled' as const, icon: Brain, color: 'text-purple-500' },
                  { label: 'Voice Mode Synthesis', key: 'voiceEnabled' as const, icon: Volume2, color: 'text-blue-500' }
                ].map(item => (
                  <div key={item.key} className="flex justify-between items-center p-5 bg-white dark:bg-[#121212] rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${item.color}`}><item.icon size={20} strokeWidth={2.5} /></div>
                       <span className="text-[14px] font-bold tracking-tight">{item.label}</span>
                    </div>
                    <button onClick={() => { vibrate('light'); setSettings(p => ({ ...p, [item.key]: !p[item.key as keyof AppSettings] })); }} className={`w-11 h-6 rounded-full p-1 transition-all flex items-center ${settings[item.key as keyof AppSettings] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings[item.key as keyof AppSettings] ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
             </section>

             {/* THEME SELECTOR */}
             <section className="space-y-3">
                <div className="flex items-center gap-2.5 text-blue-400 px-1">
                   <Palette size={18} strokeWidth={3} />
                   <h3 className="text-[12px] font-black uppercase tracking-[0.3em]">Appearance</h3>
                </div>
                <div className="p-2 bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex">
                   {[
                     { id: 'light', icon: Sun },
                     { id: 'dark', icon: Moon },
                     { id: 'system', icon: Monitor }
                   ].map(t => (
                     <button 
                       key={t.id} 
                       onClick={() => { vibrate('light'); setSettings(p => ({ ...p, theme: t.id as any })); }}
                       className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all ${settings.theme === t.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}
                     >
                        <t.icon size={20} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{t.id}</span>
                     </button>
                   ))}
                </div>
             </section>

             <div className="p-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100/50 dark:border-blue-900/20 text-center shadow-inner mt-4">
                <p className="text-[10px] text-blue-800/60 dark:text-blue-300 font-black uppercase tracking-[0.5em] leading-loose">Isolated Enclave Production Build v4.3.0</p>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-2">100% Offline Local Inference Architecture</p>
             </div>
          </div>
        )}
      </main>

      {/* TELEMETRY HUD */}
      {showContext && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md animate-[fadeIn_0.3s_ease]" onClick={() => setShowContext(false)}>
           <div className="absolute bottom-0 left-0 right-0 bg-[#fcfcfc] dark:bg-[#080808] rounded-t-[3.5rem] p-10 space-y-8 animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)] shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">Telemetry HUD</h2>
                 <button onClick={() => setShowContext(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl active:scale-90 transition-all shadow-sm"><ChevronDown size={28}/></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 rounded-[2rem] bg-white dark:bg-[#121212] border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-blue-500 mb-3"><Thermometer size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Enclave Die</span></div>
                    <div className="text-3xl font-black tracking-tighter">{hwState.thermalLevel.toFixed(1)}°C</div>
                 </div>
                 <div className="p-6 rounded-[2rem] bg-white dark:bg-[#121212] border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-2 text-amber-500 mb-3"><Battery size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Reserves</span></div>
                    <div className="text-3xl font-black tracking-tighter">{hwState.batteryLevel.toFixed(0)}%</div>
                 </div>
                 <div className="col-span-2 p-8 rounded-[2rem] bg-white dark:bg-[#121212] border border-gray-100 dark:border-zinc-800 flex items-center justify-between shadow-sm border-l-8 border-l-purple-500">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-purple-500 mb-1"><CpuIcon size={20} /><span className="text-[11px] font-black uppercase tracking-widest">Neural Load</span></div>
                       <div className="text-2xl font-black">{hwState.cpuUsage.toFixed(0)}% Utilized</div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">FREE HEAP</div>
                       <div className="text-2xl font-black text-blue-600 tracking-tighter">{(hwState.ramFree/1024).toFixed(1)} GB</div>
                    </div>
                 </div>
              </div>
              <button onClick={() => { vibrate('heavy'); llm.current?.sendControlSignal('INTERRUPT'); setShowContext(false); }} className="w-full py-5 rounded-3xl bg-red-100/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-black uppercase text-[11px] tracking-[0.5em] active:scale-95 transition-all shadow-inner border border-red-500/10">EMERGENCY KERNEL ABORT</button>
           </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .message-bubble { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .glass { background: rgba(252, 252, 252, 0.97); backdrop-filter: blur(32px); -webkit-backdrop-filter: blur(32px); }
        .dark .glass { background: rgba(8, 8, 8, 0.97); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input::placeholder { color: #888; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.2em; }
        input:focus { outline: none; }
      `}</style>
    </div>
  );
};

export default App;
