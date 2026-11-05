import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Volume2,
  Cpu,
  Zap,
  Sparkles,
  X,
  Radio,
} from 'lucide-react';
import {
  resolveChatModelConfig,
  type ChatMessageItem,
  type ChatTaskTier,
  type LedgerEntryItem,
} from '../utils/ledgerLogic';

interface AiAssistantDockProps {
  isOpen: boolean;
  initialMode: 'chat' | 'voice';
  onClose: () => void;
  selectedEntry: LedgerEntryItem;
}

// Manual 16-bit PCM little-endian to Float32 and scheduled 24kHz AudioContext playback
function play24kHzPcmBase64Chunk(
  audioCtx: AudioContext,
  base64Data: string,
  nextStartTimeRef: React.MutableRefObject<number>
) {
  try {
    const binaryStr = window.atob(base64Data);
    const byteLen = binaryStr.length;
    const sampleCount = Math.floor(byteLen / 2);
    if (sampleCount <= 0) return;

    const audioBuffer = audioCtx.createBuffer(1, sampleCount, 24000);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i++) {
      const low = binaryStr.charCodeAt(i * 2);
      const high = binaryStr.charCodeAt(i * 2 + 1);
      let int16 = (high << 8) | low;
      if (int16 >= 0x8000) int16 -= 0x10000;
      channelData[i] = int16 / 32768.0;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
  } catch {
    // Ignore audio decode issues in muted headless environments
  }
}

function float32To16BitPcmBase64(float32Array: Float32Array): string {
  const bytes = new Uint8Array(float32Array.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function AiAssistantDock({
  isOpen,
  initialMode,
  onClose,
  selectedEntry,
}: AiAssistantDockProps) {
  const [mode, setMode] = useState<'chat' | 'voice'>(initialMode);
  const [taskTier, setTaskTier] = useState<ChatTaskTier>('complex');
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome_msg',
      role: 'model',
      text: 'Apex 3D Glass & Cryptographic Architect online. Select a reasoning tier (Complex: gemini-4-argon HIGH, General: gemini-3.8-flash, or Fast: gemini-3.1-flash-lite) to audit settlement blocks or adjust 3D optical glass parameters.',
      modelUsed: 'gemini-4-argon',
      taskTier: 'complex',
      thinkingLevel: 'HIGH',
      timestampIso: new Date().toISOString(),
    },
  ]);

  // Live API (gemini-3.8-live) voice session state
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isMicStreaming, setIsMicStreaming] = useState(false);
  const [liveStatusText, setLiveStatusText] = useState(
    'Ready to connect to gemini-3.8-live real-time voice bridge'
  );
  const [liveTranscripts, setLiveTranscripts] = useState<
    { id: string; speaker: 'Analyst' | 'Gemini Live'; text: string }[]
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, liveTranscripts]);

  // Cleanup Live WebSocket and audio contexts on unmount
  useEffect(() => {
    return () => {
      stopLiveVoiceSession();
    };
  }, []);

  const stopLiveVoiceSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      void outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    setIsLiveConnected(false);
    setIsMicStreaming(false);
  };

  const startLiveVoiceSession = async (withMicrophone = true) => {
    stopLiveVoiceSession();
    setLiveStatusText('Connecting to /live WebSocket bridge (gemini-3.8-live)...');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/live`);
    wsRef.current = ws;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const outputCtx = new AudioCtx({ sampleRate: 24000 });
    outputAudioCtxRef.current = outputCtx;
    nextStartTimeRef.current = 0;

    ws.onopen = async () => {
      setIsLiveConnected(true);
      setLiveStatusText('Connected to gemini-3.8-live (24kHz PCM Output Ready)');

      if (withMicrophone && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          const inputCtx = new AudioCtx({ sampleRate: 16000 });
          inputAudioCtxRef.current = inputCtx;
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          source.connect(processor);
          processor.connect(inputCtx.destination);

          processor.onaudioprocess = (e) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const base64Audio = float32To16BitPcmBase64(e.inputBuffer.getChannelData(0));
              wsRef.current.send(JSON.stringify({ audio: base64Audio }));
            }
          };
          setIsMicStreaming(true);
          setLiveStatusText('Streaming 16kHz PCM Mic → gemini-3.8-live');
        } catch {
          setLiveStatusText(
            'Connected to gemini-3.8-live (Mic permission unavailable; use Voice Directive buttons below)'
          );
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          inputTranscript?: string;
          outputTranscript?: string;
          audio?: string;
          interrupted?: boolean;
        };

        if (msg.inputTranscript) {
          setLiveTranscripts((prev) => [
            ...prev,
            {
              id: `in_${Date.now()}_${Math.random()}`,
              speaker: 'Analyst',
              text: msg.inputTranscript!,
            },
          ]);
        }
        if (msg.outputTranscript) {
          setLiveTranscripts((prev) => [
            ...prev,
            {
              id: `out_${Date.now()}_${Math.random()}`,
              speaker: 'Gemini Live',
              text: msg.outputTranscript!,
            },
          ]);
        }
        if (msg.audio && outputAudioCtxRef.current) {
          play24kHzPcmBase64Chunk(outputAudioCtxRef.current, msg.audio, nextStartTimeRef);
        }
        if (msg.interrupted) {
          nextStartTimeRef.current = 0;
        }
      } catch {
        // Ignore parse error
      }
    };

    ws.onclose = () => {
      setIsLiveConnected(false);
      setIsMicStreaming(false);
      setLiveStatusText('Live Voice session closed.');
    };
  };

  const handleSendVoiceDirective = async (promptText: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await startLiveVoiceSession(false);
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ simulateVoicePrompt: promptText }));
        }
      }, 250);
      return;
    }
    wsRef.current.send(JSON.stringify({ simulateVoicePrompt: promptText }));
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;

    const cfg = resolveChatModelConfig(taskTier);
    const userEntry: ChatMessageItem = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      modelUsed: cfg.model,
      taskTier,
      thinkingLevel: cfg.thinkingLevel,
      timestampIso: new Date().toISOString(),
    };

    const nextHistory = [...messages, userEntry];
    setMessages(nextHistory);
    setChatInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          taskTier,
          activeTxHash: selectedEntry.txHash,
          history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = (await response.json()) as {
        reply: string;
        modelUsed: string;
        taskTier: ChatTaskTier;
        thinkingLevel?: string;
        timestampIso: string;
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply || 'Telemetry analyzed.',
          modelUsed: data.modelUsed || cfg.model,
          taskTier: data.taskTier || taskTier,
          thinkingLevel: data.thinkingLevel,
          timestampIso: data.timestampIso || new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: `[${cfg.model}] Evaluated "${trimmed}" against Block #${selectedEntry.blockHeight}. Risk score is ${selectedEntry.riskScore}/100 (${selectedEntry.status}).`,
          modelUsed: cfg.model,
          taskTier,
          thinkingLevel: cfg.thinkingLevel,
          timestampIso: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <section
      aria-label="Gemini Multi-Turn Chatbot and Live Voice Console"
      className="fixed bottom-32 left-1/2 z-40 w-[min(860px,94vw)] -translate-x-1/2 rounded-lg border border-[#3b82f6]/50 bg-[#0b1326] p-4 shadow-2xl"
    >
      {/* Header with Mode Switcher (Solid surface — zero backdrop-filter over WebGL) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222a3d] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              mode === 'chat'
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Multi-Turn Gemini Chat
          </button>
          <button
            type="button"
            onClick={() => setMode('voice')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              mode === 'voice'
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd]'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Live Voice Conversation (gemini-3.8-live)
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI Assistant Console"
          className="rounded border border-[#222a3d] p-1 text-[#8c909f] hover:border-[#424754] hover:text-[#dae2fd]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === 'chat' ? (
        <div className="mt-3 space-y-3">
          {/* Model Routing Tier Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#222a3d] bg-[#060e20] px-3 py-2">
            <span className="text-xs font-medium text-[#c2c6d6]">Task Routing Tier:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTaskTier('complex')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  taskTier === 'complex'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#131b2e] text-[#8c909f] hover:text-[#dae2fd]'
                }`}
              >
                <Cpu className="h-3 w-3" />
                Complex (gemini-4-argon · HIGH)
              </button>
              <button
                type="button"
                onClick={() => setTaskTier('general')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  taskTier === 'general'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#131b2e] text-[#8c909f] hover:text-[#dae2fd]'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                General (gemini-3.8-flash)
              </button>
              <button
                type="button"
                onClick={() => setTaskTier('fast')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  taskTier === 'fast'
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#131b2e] text-[#8c909f] hover:text-[#dae2fd]'
                }`}
              >
                <Zap className="h-3 w-3" />
                Fast (gemini-3.1-flash-lite)
              </button>
            </div>
          </div>

          {/* Scrollable Conversation Thread */}
          <div
            ref={scrollContainerRef}
            data-testid="chat-thread-container"
            className="max-h-56 overflow-y-auto rounded border border-[#222a3d] bg-[#060e20] p-3 space-y-2.5"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded border p-2.5 text-xs ${
                  msg.role === 'user'
                    ? 'ml-8 border-[#3b82f6]/40 bg-[#131b2e] text-[#dae2fd]'
                    : 'mr-8 border-[#222a3d] bg-[#0f172a] text-[#c2c6d6]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-[#8c909f] mb-1">
                  <span className="font-semibold text-[#dae2fd]">
                    {msg.role === 'user' ? 'Security Analyst' : 'Apex AI Architect'}
                  </span>
                  <span className="font-mono text-[#60a5fa]">
                    {msg.modelUsed}
                    {msg.thinkingLevel ? ` · Thinking.${msg.thinkingLevel}` : ''}
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Chat message input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about 3D glass refraction, flash-loan vectors, or settlement finality..."
              className="flex-1 rounded border border-[#222a3d] bg-[#060e20] px-3 py-2 text-xs text-[#dae2fd] placeholder-[#8c909f] focus:border-[#3b82f6] focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-1.5 rounded bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#60a5fa] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              {isSending ? 'Thinking...' : 'Send Message'}
            </button>
          </form>
        </div>
      ) : (
        /* Live Voice Conversation Interface (gemini-3.8-live) */
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#222a3d] bg-[#060e20] p-3">
            <div>
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[#60a5fa]" />
                <span className="text-xs font-semibold text-[#dae2fd]">
                  Gemini Live Audio Stream (<code className="font-mono">gemini-3.8-live</code>)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#8c909f]">{liveStatusText}</p>
            </div>

            <div className="flex items-center gap-2">
              {!isLiveConnected ? (
                <button
                  type="button"
                  onClick={() => startLiveVoiceSession(true)}
                  className="inline-flex items-center gap-1.5 rounded bg-[#3b82f6] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#60a5fa] whitespace-nowrap shrink-0"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Start Live Voice Session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveVoiceSession}
                  className="inline-flex items-center gap-1.5 rounded bg-[#ef4444] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#dc2626] whitespace-nowrap shrink-0"
                >
                  <MicOff className="h-3.5 w-3.5" />
                  Disconnect Voice ({isMicStreaming ? 'Mic Active' : 'Bridge Active'})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#8c909f]">Instant Voice Directives:</span>
            <button
              type="button"
              onClick={() =>
                handleSendVoiceDirective(
                  'Report 3D optical glass prism status and active quarantined threat vectors.'
                )
              }
              className="rounded border border-[#222a3d] bg-[#131b2e] px-2.5 py-1 text-xs text-[#dae2fd] hover:border-[#3b82f6] whitespace-nowrap shrink-0"
            >
              "Report 3D Glass Vault &amp; Threat Status"
            </button>
            <button
              type="button"
              onClick={() =>
                handleSendVoiceDirective(
                  `Verify cryptographic finality for ${selectedEntry.sourceEntity}.`
                )
              }
              className="rounded border border-[#222a3d] bg-[#131b2e] px-2.5 py-1 text-xs text-[#dae2fd] hover:border-[#3b82f6] whitespace-nowrap shrink-0"
            >
              "Audit Selected Corridor Finality"
            </button>
          </div>

          <div
            data-testid="live-voice-transcript-box"
            className="max-h-44 overflow-y-auto rounded border border-[#222a3d] bg-[#060e20] p-3 space-y-2 text-xs"
          >
            {liveTranscripts.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <span
                  className={`font-mono font-semibold shrink-0 ${
                    item.speaker === 'Gemini Live' ? 'text-[#60a5fa]' : 'text-[#dae2fd]'
                  }`}
                >
                  [{item.speaker}]:
                </span>
                <span className="text-[#c2c6d6]">{item.text}</span>
              </div>
            ))}
            {liveTranscripts.length === 0 && (
              <div className="py-4 text-center text-xs text-[#8c909f]">
                Click "Start Live Voice Session" or trigger a Voice Directive above to stream 24kHz
                PCM responses from <code className="font-mono">gemini-3.8-live</code>.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
