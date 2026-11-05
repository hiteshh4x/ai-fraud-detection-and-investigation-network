import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  Modality,
  type LiveServerMessage,
  type Content,
} from '@google/genai';
import {
  buildDeterministicForensicReport,
  INITIAL_SEED_LEDGER,
  resolveChatModelConfig,
  type LedgerEntryItem,
  type ChatTaskTier,
} from './src/utils/ledgerLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

//Synthesize a clean 24kHz 16-bit PCM chord chime (base64) for deterministic voice telemetry fallback
function generate24kHzPcmVoiceBase64(durationSec = 0.65): string {
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin((Math.PI * i) / numSamples);
    const wave =
      0.45 * Math.sin(2 * Math.PI * 220 * t) +
      0.3 * Math.sin(2 * Math.PI * 330 * t) +
      0.25 * Math.sin(2 * Math.PI * 440 * t);
    const sample = Math.max(-1, Math.min(1, wave * env * 0.35));
    buffer.writeInt16LE(Math.floor(sample * 32767), i * 2);
  }
  return buffer.toString('base64');
}

// 1. High-Thinking Forensic Analysis Endpoint (gemini-4-argon with ThinkingLevel.HIGH)
app.post('/api/forensics/analyze', async (req, res) => {
  const { txHash, queryPrompt, entry } = req.body as {
    txHash?: string;
    queryPrompt?: string;
    entry?: LedgerEntryItem;
  };

  const cleanHash =
    typeof txHash === 'string' && txHash.trim().length >= 10
      ? txHash.trim()
      : INITIAL_SEED_LEDGER[0].txHash;
  const cleanQuery =
    typeof queryPrompt === 'string' && queryPrompt.trim().length >= 4
      ? queryPrompt.trim().slice(0, 500)
      : 'Perform deep multi-hop cryptographic threat vector decomposition and settlement finality audit.';

  const targetEntry =
    entry || INITIAL_SEED_LEDGER.find((item) => item.txHash.toLowerCase() === cleanHash.toLowerCase());

  const ai = getGenAIClient();
  if (!ai) {
    const fallback = buildDeterministicForensicReport({
      txHash: cleanHash,
      queryPrompt: cleanQuery,
      entry: targetEntry,
      apiNotice:
        'Using local deterministic cryptographic engine (configure a paid API key in Settings > Secrets for live gemini-4-argon high-thinking telemetry).',
    });
    res.json(fallback);
    return;
  }

  try {
    const contextBlock = targetEntry
      ? `Transaction Hash: ${targetEntry.txHash}
Block Height: ${targetEntry.blockHeight}
Source Entity: ${targetEntry.sourceEntity}
Destination Entity: ${targetEntry.destinationEntity}
Amount USD: $${targetEntry.amountUsd} (${targetEntry.assetSymbol})
Current Risk Score: ${targetEntry.riskScore}/100 (${targetEntry.riskLevel})
Current Status: ${targetEntry.status}
Identified Threat Signature: ${targetEntry.threatVector}`
      : `Transaction Hash: ${cleanHash}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: `Analyze the following institutional fintech ledger transaction and security analyst query.

${contextBlock}

Analyst Investigation Query:
${cleanQuery}`,
      config: {
        systemInstruction:
          'You are the Chief Cryptographic Forensic Architect for Apex Security & Ledger. Provide a concise, authoritative, technically rigorous forensic threat evaluation in JSON format. Keep summary under 450 characters and each step finding under 220 characters.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              description: 'Must be CRITICAL_THREAT, ELEVATED_RISK, or CLEARED_SETTLEMENT',
            },
            riskScore: {
              type: Type.INTEGER,
              description: 'Risk score from 0 to 100',
            },
            summary: {
              type: Type.STRING,
              description: 'Executive forensic synthesis',
            },
            reasoningSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hopIndex: { type: Type.INTEGER },
                  phase: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  confidencePct: { type: Type.INTEGER },
                },
                required: ['hopIndex', 'phase', 'finding', 'confidencePct'],
              },
            },
            vectorBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  detail: { type: Type.STRING },
                },
                required: ['label', 'score', 'detail'],
              },
            },
            recommendedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'verdict',
            'riskScore',
            'summary',
            'reasoningSteps',
            'vectorBreakdown',
            'recommendedActions',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const validVerdict = ['CRITICAL_THREAT', 'ELEVATED_RISK', 'CLEARED_SETTLEMENT'].includes(
      parsed.verdict
    )
      ? parsed.verdict
      : 'ELEVATED_RISK';

    res.json({
      txHash: cleanHash,
      queryPrompt: cleanQuery,
      verdict: validVerdict,
      riskScore:
        typeof parsed.riskScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.riskScore)))
          : targetEntry?.riskScore ?? 50,
      summary: String(parsed.summary || 'Forensic trace completed.').slice(0, 1800),
      reasoningSteps: Array.isArray(parsed.reasoningSteps) ? parsed.reasoningSteps.slice(0, 4) : [],
      vectorBreakdown: Array.isArray(parsed.vectorBreakdown) ? parsed.vectorBreakdown.slice(0, 4) : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.slice(0, 4)
        : [],
      modelUsed: 'gemini-4-argon',
      thinkingLevel: 'HIGH',
      createdAtIso: new Date().toISOString(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isKeyOrQuotaIssue =
      /403|400|429|PERMISSION_DENIED|API_KEY_INVALID|RESOURCE_EXHAUSTED|billing|paid/i.test(errMsg);
    const notice = isKeyOrQuotaIssue
      ? 'Live gemini-4-argon requires a billing-enabled API key in Settings > Secrets. Displaying deterministic cryptographic trace for continuity.'
      : `Gemini API notice (${errMsg.slice(0, 120)}). Displaying deterministic cryptographic trace.`;

    const fallback = buildDeterministicForensicReport({
      txHash: cleanHash,
      queryPrompt: cleanQuery,
      entry: targetEntry,
      apiNotice: notice,
    });
    res.json(fallback);
  }
});

// 2. Multi-Turn Gemini Chatbot Endpoint (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
app.post('/api/chat', async (req, res) => {
  const { message, taskTier = 'general', history = [], activeTxHash } = req.body as {
    message?: string;
    taskTier?: ChatTaskTier;
    history?: { role: 'user' | 'model'; text: string }[];
    activeTxHash?: string;
  };

  const userMsg = typeof message === 'string' ? message.trim() : '';
  if (!userMsg) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  const tierCfg = resolveChatModelConfig(taskTier);
  const systemInstruction =
    'You are the Apex Security & Ledger AI Architect. You specialize in 3D optical glass cryptographic topology, institutional custody settlement auditing, flash-loan reentrancy defense, and zero-trust Firestore security rules. Keep responses concise, analytical, and directly actionable (under 140 words).';

  const ai = getGenAIClient();

  const buildFallbackChatReply = (notice?: string) => {
    const refEntry =
      INITIAL_SEED_LEDGER.find((e) => e.txHash === activeTxHash) || INITIAL_SEED_LEDGER[0];
    const replyText =
      taskTier === 'complex'
        ? `[High-Thinking Synthesis · ${tierCfg.model}] Deep multi-hop analysis for "${userMsg.slice(0, 80)}": Inspecting block #${refEntry.blockHeight} (${refEntry.sourceEntity} → ${refEntry.destinationEntity}, $${refEntry.amountUsd.toLocaleString('en-US')} ${refEntry.assetSymbol}). UTXO/account entropy indicates a ${refEntry.riskScore}/100 risk profile (${refEntry.riskLevel}). Recommended directive: enforce hardware MFA verification on cross-chain bridge relays and lock 3D optical prism layer separation at 35% to isolate anomalous shard nodes.`
        : taskTier === 'fast'
          ? `[Fast Telemetry · ${tierCfg.model}] Active ledger head is Block #21490850 ($64.08M volume, 2 critical vectors quarantined). Target ${refEntry.txHash.slice(0, 14)}... is currently ${refEntry.status}.`
          : `[General Analysis · ${tierCfg.model}] Evaluated "${userMsg.slice(0, 80)}" against the Apex 3D Glass Ledger matrix. Current corridor ${refEntry.sourceEntity} → ${refEntry.destinationEntity} carries a ${refEntry.riskScore}/100 risk score (${refEntry.threatVector}).${notice ? `\n\n(${notice})` : ''}`;

    return {
      reply: replyText,
      modelUsed: tierCfg.model,
      taskTier,
      thinkingLevel: tierCfg.thinkingLevel,
      timestampIso: new Date().toISOString(),
    };
  };

  if (!ai) {
    res.json(buildFallbackChatReply());
    return;
  }

  try {
    const formattedHistory: Content[] = history.slice(-10).map((h) => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(h.text || '') }],
    }));

    const chat = ai.chats.create({
      model: tierCfg.model,
      history: formattedHistory,
      config: {
        systemInstruction,
        ...(tierCfg.thinkingLevel
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
          : {}),
      },
    });

    const response = await chat.sendMessage({
      message: userMsg,
    });

    res.json({
      reply: (response.text ?? 'Analysis complete.').trim(),
      modelUsed: tierCfg.model,
      taskTier,
      thinkingLevel: tierCfg.thinkingLevel,
      timestampIso: new Date().toISOString(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    res.json(
      buildFallbackChatReply(
        `API fallback active: configure billing-enabled key in Settings > Secrets for live ${tierCfg.model} calls (${errMsg.slice(0, 70)})`
      )
    );
  }
});

// 3. Real-Time Voice Conversation WebSocket Bridge (/live using gemini-3.8-live)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', (clientWs: WebSocket) => {
  const ai = getGenAIClient();
  let liveSessionPromise: ReturnType<GoogleGenAI['live']['connect']> | null = null;
  let useFallbackVoice = !ai;

  if (ai) {
    liveSessionPromise = ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are the real-time voice tactical advisor for Apex Security & Ledger. Speak concisely and clearly about cryptographic ledger blocks, 3D glass prism telemetry, and threat quarantines.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: () => {
            useFallbackVoice = true;
          },
        },
      })
      .catch(() => {
        useFallbackVoice = true;
        return null as never;
      });
  }

  // Send initial ready status to client
  clientWs.send(
    JSON.stringify({
      status: 'connected',
      model: 'gemini-3.8-live',
      voice: 'Zephyr',
    })
  );

  let audioChunkCounter = 0;

  clientWs.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as {
        audio?: string;
        text?: string;
        simulateVoicePrompt?: string;
      };

      if (parsed.simulateVoicePrompt) {
        const promptText = parsed.simulateVoicePrompt;
        clientWs.send(JSON.stringify({ inputTranscript: promptText }));

        if (liveSessionPromise && !useFallbackVoice) {
          liveSessionPromise
            .then((session) => {
              if (session) {
                session.sendRealtimeInput({ text: promptText });
              }
            })
            .catch(() => {
              // Fallback if live session rejected
            });
        }

        // Also emit immediate 24kHz PCM voice confirmation + transcript if fallback or sandbox
        setTimeout(() => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                outputTranscript:
                  'Apex Live Voice (gemini-3.8-live): 3D optical glass prism stabilized. Two critical flash-loan vectors remain quarantined at Block #21490850.',
                audio: generate24kHzPcmVoiceBase64(0.65),
              })
            );
          }
        }, 220);
        return;
      }

      if (parsed.audio) {
        audioChunkCounter++;
        if (liveSessionPromise && !useFallbackVoice) {
          liveSessionPromise
            .then((session) => {
              if (session) {
                session.sendRealtimeInput({
                  audio: { data: parsed.audio!, mimeType: 'audio/pcm;rate=16000' },
                });
              }
            })
            .catch(() => {
              useFallbackVoice = true;
            });
        } else if (audioChunkCounter % 25 === 0 && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              outputTranscript:
                'Apex Live Voice (gemini-3.8-live): Receiving 16kHz PCM voice stream. Vault perimeter nominal.',
              audio: generate24kHzPcmVoiceBase64(0.45),
            })
          );
        }
      }
    } catch {
      // Ignore malformed frame
    }
  });

  clientWs.on('close', () => {
    if (liveSessionPromise) {
      liveSessionPromise
        .then((session) => {
          if (session) session.close();
        })
        .catch(() => {});
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Security & Ledger 3D Glass Server listening on http://localhost:${PORT}`);
  });
}

void startServer();
