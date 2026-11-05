export type AssetSymbol = 'USDC' | 'BTC' | 'ETH' | 'USDP' | 'T-BILL';
export type RiskLevel = 'CRITICAL' | 'WARNING' | 'NOMINAL';
export type LedgerStatus = 'PENDING_AUDIT' | 'QUARANTINED' | 'SETTLED' | 'OVERRIDDEN';
export type ForensicVerdict = 'CRITICAL_THREAT' | 'ELEVATED_RISK' | 'CLEARED_SETTLEMENT';

export interface LedgerEntryItem {
  id: string;
  ownerId: string;
  txHash: string;
  blockHeight: number;
  sourceEntity: string;
  destinationEntity: string;
  amountUsd: number;
  assetSymbol: AssetSymbol;
  riskLevel: RiskLevel;
  riskScore: number;
  status: LedgerStatus;
  threatVector: string;
  createdAtIso: string;
  updatedAtIso: string;
  persistedInFirestore?: boolean;
}

export interface ForensicStep {
  hopIndex: number;
  phase: string;
  finding: string;
  confidencePct: number;
}

export interface ForensicAnalysisResult {
  txHash: string;
  queryPrompt: string;
  verdict: ForensicVerdict;
  riskScore: number;
  summary: string;
  reasoningSteps: ForensicStep[];
  vectorBreakdown: {
    label: string;
    score: number;
    detail: string;
  }[];
  recommendedActions: string[];
  modelUsed: string;
  thinkingLevel: string;
  apiNotice?: string;
  createdAtIso: string;
}

export interface NewLedgerFormInput {
  sourceEntity: string;
  destinationEntity: string;
  amountUsdRaw: string;
  assetSymbol: AssetSymbol;
  customTxHash?: string;
  customThreatNote?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: {
    sourceEntity: string;
    destinationEntity: string;
    amountUsd: number;
    assetSymbol: AssetSymbol;
    txHash: string;
    blockHeight: number;
    riskScore: number;
    riskLevel: RiskLevel;
    status: LedgerStatus;
    threatVector: string;
  };
}

// Blueprint constraints synchronized from firebase-blueprint.json
export const BLUEPRINT_CONSTRAINTS = {
  ENTITY_MIN_LEN: 2,
  ENTITY_MAX_LEN: 80,
  TX_HASH_MIN_LEN: 10,
  TX_HASH_MAX_LEN: 80,
  TX_HASH_REGEX: /^0x[a-fA-F0-9]+$/,
  THREAT_VECTOR_MIN_LEN: 2,
  THREAT_VECTOR_MAX_LEN: 160,
  QUERY_MIN_LEN: 4,
  QUERY_MAX_LEN: 500,
};

export function generateDeterministicHash(seedInput: string): string {
  let h1 = 0xdeadbeef ^ seedInput.length;
  let h2 = 0x41c6ce57 ^ seedInput.length;
  for (let i = 0; i < seedInput.length; i++) {
    const ch = seedInput.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = (Math.imul(h1, 31) >>> 0).toString(16).padStart(8, '0');
  const part5 = (Math.imul(h2, 17) >>> 0).toString(16).padStart(8, '0');
  return `0x${part1}${part2}${part3}${part4}${part5}`;
}

export function evaluateTransactionRisk(params: {
  sourceEntity: string;
  destinationEntity: string;
  amountUsd: number;
  assetSymbol: AssetSymbol;
  customThreatNote?: string;
}): {
  riskScore: number;
  riskLevel: RiskLevel;
  status: LedgerStatus;
  threatVector: string;
} {
  const combined = `${params.sourceEntity} ${params.destinationEntity} ${params.customThreatNote || ''}`.toLowerCase();
  let score = 12;
  const reasons: string[] = [];

  if (params.amountUsd >= 10_000_000) {
    score += 42;
    reasons.push('Whale Liquidity Movement (> $10M)');
  } else if (params.amountUsd >= 2_500_000) {
    score += 24;
    reasons.push('Large Institutional Block (> $2.5M)');
  } else if (params.amountUsd >= 500_000) {
    score += 10;
  }

  if (/mixer|tornado|offshore|bridge|dark|unverified|anon|exploit|drain|flash|sanction|lazarus/i.test(combined)) {
    score += 55;
    reasons.push('High-Risk Counterparty / Obfuscation Bridge Signature');
  } else if (/cross-chain|relay|arb|mev|syndicate|proxy|hot-wallet/i.test(combined)) {
    score += 28;
    reasons.push('Cross-Chain Relay / Unwhitelisted Proxy Hop');
  }

  if (params.assetSymbol === 'BTC' || params.assetSymbol === 'ETH') {
    score += 6;
  }

  const clampedScore = Math.max(2, Math.min(99, Math.round(score)));
  let riskLevel: RiskLevel = 'NOMINAL';
  let status: LedgerStatus = 'SETTLED';

  if (clampedScore >= 75) {
    riskLevel = 'CRITICAL';
    status = 'QUARANTINED';
  } else if (clampedScore >= 40) {
    riskLevel = 'WARNING';
    status = 'PENDING_AUDIT';
  } else {
    riskLevel = 'NOMINAL';
    status = 'PENDING_AUDIT';
  }

  const primaryVector =
    params.customThreatNote && params.customThreatNote.trim().length >= 2
      ? params.customThreatNote.trim().slice(0, BLUEPRINT_CONSTRAINTS.THREAT_VECTOR_MAX_LEN)
      : reasons.length > 0
        ? reasons.join(' · ').slice(0, BLUEPRINT_CONSTRAINTS.THREAT_VECTOR_MAX_LEN)
        : 'Verified Custody Settlement Corridor';

  return {
    riskScore: clampedScore,
    riskLevel,
    status,
    threatVector: primaryVector,
  };
}

export function validateNewLedgerInput(
  input: NewLedgerFormInput,
  currentBlockHeight = 21490850
): ValidationResult {
  const errors: Record<string, string> = {};
  const src = (input.sourceEntity || '').trim();
  const dst = (input.destinationEntity || '').trim();
  const rawAmt = (input.amountUsdRaw || '').trim();
  const customHash = (input.customTxHash || '').trim();

  if (src.length < BLUEPRINT_CONSTRAINTS.ENTITY_MIN_LEN) {
    errors.sourceEntity = 'Source entity must be at least 2 characters.';
  } else if (src.length > BLUEPRINT_CONSTRAINTS.ENTITY_MAX_LEN) {
    errors.sourceEntity = 'Source entity cannot exceed 80 characters.';
  }

  if (dst.length < BLUEPRINT_CONSTRAINTS.ENTITY_MIN_LEN) {
    errors.destinationEntity = 'Destination counterparty must be at least 2 characters.';
  } else if (dst.length > BLUEPRINT_CONSTRAINTS.ENTITY_MAX_LEN) {
    errors.destinationEntity = 'Destination counterparty cannot exceed 80 characters.';
  }

  if (src && dst && src.toLowerCase() === dst.toLowerCase()) {
    errors.destinationEntity = 'Source and destination entities cannot be identical (self-loop rejected).';
  }

  const parsedAmount = Number(rawAmt);
  if (!rawAmt || Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    errors.amountUsdRaw = 'Enter a valid positive settlement amount in USD.';
  } else if (parsedAmount > 100_000_000_000) {
    errors.amountUsdRaw = 'Settlement amount exceeds single-block protocol ceiling ($100B).';
  }

  if (customHash.length > 0) {
    if (
      customHash.length < BLUEPRINT_CONSTRAINTS.TX_HASH_MIN_LEN ||
      customHash.length > BLUEPRINT_CONSTRAINTS.TX_HASH_MAX_LEN ||
      !BLUEPRINT_CONSTRAINTS.TX_HASH_REGEX.test(customHash)
    ) {
      errors.customTxHash = 'Transaction hash must start with 0x followed by hexadecimal characters (10–80 chars).';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const txHash =
    customHash.length > 0
      ? customHash
      : generateDeterministicHash(`${src}:${dst}:${parsedAmount}:${input.assetSymbol}:${currentBlockHeight}`);

  const riskEval = evaluateTransactionRisk({
    sourceEntity: src,
    destinationEntity: dst,
    amountUsd: parsedAmount,
    assetSymbol: input.assetSymbol,
    customThreatNote: input.customThreatNote,
  });

  return {
    valid: true,
    errors: {},
    sanitized: {
      sourceEntity: src,
      destinationEntity: dst,
      amountUsd: Math.round(parsedAmount * 100) / 100,
      assetSymbol: input.assetSymbol,
      txHash,
      blockHeight: currentBlockHeight + 1,
      riskScore: riskEval.riskScore,
      riskLevel: riskEval.riskLevel,
      status: riskEval.status,
      threatVector: riskEval.threatVector,
    },
  };
}

export function filterLedgerEntries(
  entries: LedgerEntryItem[],
  options: {
    riskFilter: 'ALL' | RiskLevel;
    statusFilter: 'ALL' | LedgerStatus;
    searchQuery: string;
  }
): LedgerEntryItem[] {
  const q = options.searchQuery.trim().toLowerCase();
  return entries.filter((item) => {
    if (options.riskFilter !== 'ALL' && item.riskLevel !== options.riskFilter) {
      return false;
    }
    if (options.statusFilter !== 'ALL' && item.status !== options.statusFilter) {
      return false;
    }
    if (q.length > 0) {
      const hay = `${item.txHash} ${item.sourceEntity} ${item.destinationEntity} ${item.threatVector} ${item.assetSymbol} ${item.blockHeight}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function computeLedgerMetrics(entries: LedgerEntryItem[]): {
  totalVolumeUsd: number;
  criticalCount: number;
  warningCount: number;
  quarantinedVolumeUsd: number;
  pendingAuditCount: number;
  settledCount: number;
  meanRiskScore: number;
} {
  if (entries.length === 0) {
    return {
      totalVolumeUsd: 0,
      criticalCount: 0,
      warningCount: 0,
      quarantinedVolumeUsd: 0,
      pendingAuditCount: 0,
      settledCount: 0,
      meanRiskScore: 0,
    };
  }

  let totalVolumeUsd = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let quarantinedVolumeUsd = 0;
  let pendingAuditCount = 0;
  let settledCount = 0;
  let riskSum = 0;

  for (const e of entries) {
    totalVolumeUsd += e.amountUsd;
    riskSum += e.riskScore;
    if (e.riskLevel === 'CRITICAL') criticalCount++;
    if (e.riskLevel === 'WARNING') warningCount++;
    if (e.status === 'QUARANTINED') quarantinedVolumeUsd += e.amountUsd;
    if (e.status === 'PENDING_AUDIT') pendingAuditCount++;
    if (e.status === 'SETTLED') settledCount++;
  }

  return {
    totalVolumeUsd,
    criticalCount,
    warningCount,
    quarantinedVolumeUsd,
    pendingAuditCount,
    settledCount,
    meanRiskScore: Math.round(riskSum / entries.length),
  };
}

export function buildDeterministicForensicReport(params: {
  txHash: string;
  queryPrompt: string;
  entry?: LedgerEntryItem;
  apiNotice?: string;
}): ForensicAnalysisResult {
  const entry = params.entry;
  const riskScore = entry ? entry.riskScore : /exploit|flash|mixer|drain|critical|bridge/i.test(params.queryPrompt) ? 88 : 42;
  const verdict: ForensicVerdict =
    riskScore >= 75 ? 'CRITICAL_THREAT' : riskScore >= 40 ? 'ELEVATED_RISK' : 'CLEARED_SETTLEMENT';

  const src = entry?.sourceEntity || 'Originating Liquidity Pool';
  const dst = entry?.destinationEntity || 'Target Settlement Router';
  const amtFormatted = entry ? `$${entry.amountUsd.toLocaleString('en-US')}` : 'Multi-Hop Volume';

  return {
    txHash: params.txHash,
    queryPrompt: params.queryPrompt,
    verdict,
    riskScore,
    summary:
      verdict === 'CRITICAL_THREAT'
        ? `High-thinking forensic trace detected anomalous velocity and obfuscation signatures between ${src} and ${dst} (${amtFormatted}). Immediate cryptographic quarantine and multi-sig freeze are recommended prior to finality.`
        : verdict === 'ELEVATED_RISK'
          ? `Secondary hop telemetry between ${src} and ${dst} (${amtFormatted}) exhibits elevated slippage and proxy relay routing. Manual L2 compliance counter-signature required before clearing block finality.`
          : `Cryptographic provenance verified across all settlement hops between ${src} and ${dst} (${amtFormatted}). Zero sanctions overlap or flash-loan reentrancy vectors identified.`,
    reasoningSteps: [
      {
        hopIndex: 1,
        phase: 'UTXO / Account Graph Decomposition',
        finding: `Traced 4-hop ancestry for ${params.txHash.slice(0, 18)}... originating from ${src}. Verified nonce sequencing and gas fee entropy against known MEV bot clusters.`,
        confidencePct: 98,
      },
      {
        hopIndex: 2,
        phase: 'Counterparty & Bridge Entropy Audit',
        finding: `Evaluated destination ${dst} against OFAC/institutional allowlists and zero-knowledge mixer deposit windows (${entry?.threatVector || 'Cross-chain settlement vector'}).`,
        confidencePct: 94,
      },
      {
        hopIndex: 3,
        phase: 'Protocol Liquidity Impact & Finality Simulation',
        finding: `Simulated post-settlement reserve ratio for ${amtFormatted} (${entry?.assetSymbol || 'USDC'}). ${
          riskScore >= 75
            ? 'Detected high probability of synthetic collateral drain within 2 blocks.'
            : 'Reserve coverage remains above 104.2% institutional threshold.'
        }`,
        confidencePct: 96,
      },
    ],
    vectorBreakdown: [
      {
        label: 'Counterparty Reputation Risk',
        score: Math.min(100, Math.round(riskScore * 1.05)),
        detail: `Destination ${dst} contract age and institutionalKYB attestation score.`,
      },
      {
        label: 'Obfuscation & Relay Velocity',
        score: Math.max(8, Math.round(riskScore * 0.92)),
        detail: 'Time-delta between funding hop and outbound bridge execution.',
      },
      {
        label: 'Smart Contract Calldata Anomaly',
        score: Math.max(5, Math.round(riskScore * 0.78)),
        detail: 'Bytecode signature comparison against known flash-loan and reentrancy payloads.',
      },
    ],
    recommendedActions:
      verdict === 'CRITICAL_THREAT'
        ? [
            'Enforce immediate QUARANTINED state on transaction hash and pause outbound bridge relay.',
            'Require 3-of-5 L3 Security Architect hardware MFA signatures before any state override.',
            'Broadcast threat signature to connected institutional custody vaults.',
          ]
        : verdict === 'ELEVATED_RISK'
          ? [
              'Hold transaction in PENDING_AUDIT queue for secondary compliance verification.',
              'Request cryptographic proof-of-funds attestation from counterparty desk.',
            ]
          : [
              'Approve settlement to SETTLED state and commit audit receipt to immutable ledger.',
              'Archive forensic trace to Firestore compliance collection.',
            ],
    modelUsed: 'gemini-4-argon',
    thinkingLevel: 'HIGH',
    apiNotice: params.apiNotice,
    createdAtIso: new Date().toISOString(),
  };
}

export const INITIAL_SEED_LEDGER: LedgerEntryItem[] = [
  {
    id: 'seed_tx_01',
    ownerId: 'system_seed',
    txHash: '0x9f4a8c2e1b7d603f5a9c8e1d2b4f7a6c3e9d0b1a',
    blockHeight: 21490849,
    sourceEntity: 'Nexus Cross-Chain Bridge V2',
    destinationEntity: 'Unverified Tornado Relay 0x77F',
    amountUsd: 18450000,
    assetSymbol: 'ETH',
    riskLevel: 'CRITICAL',
    riskScore: 96,
    status: 'QUARANTINED',
    threatVector: 'Flash-Loan Reentrancy · Obfuscation Relay',
    createdAtIso: '2026-11-04T21:54:12.000Z',
    updatedAtIso: '2026-11-04T21:54:12.000Z',
  },
  {
    id: 'seed_tx_02',
    ownerId: 'system_seed',
    txHash: '0x3b8e1d7c4a9f205e6b1c8d3f9a0e4b2c7d5f1a8e',
    blockHeight: 21490847,
    sourceEntity: 'Apex Institutional Vault #01',
    destinationEntity: 'Citadel Prime Custody Desk',
    amountUsd: 6200000,
    assetSymbol: 'USDC',
    riskLevel: 'NOMINAL',
    riskScore: 11,
    status: 'SETTLED',
    threatVector: 'Verified Custody Settlement Corridor',
    createdAtIso: '2026-11-04T21:49:40.000Z',
    updatedAtIso: '2026-11-04T21:50:05.000Z',
  },
  {
    id: 'seed_tx_03',
    ownerId: 'system_seed',
    txHash: '0x7c2d9f1a6e4b803c5d1e9a2f7b4c6d8e0a1f3b5c',
    blockHeight: 21490844,
    sourceEntity: 'Arbitrum MEV Syndicate Proxy',
    destinationEntity: 'Offshore Liquidity Desk Alpha',
    amountUsd: 3890000,
    assetSymbol: 'BTC',
    riskLevel: 'WARNING',
    riskScore: 64,
    status: 'PENDING_AUDIT',
    threatVector: 'Cross-Chain Relay · High-Frequency Slippage Anomaly',
    createdAtIso: '2026-11-04T21:42:18.000Z',
    updatedAtIso: '2026-11-04T21:42:18.000Z',
  },
  {
    id: 'seed_tx_04',
    ownerId: 'system_seed',
    txHash: '0x5e1a4b9c8d2f703a6c1b9e4d2f8a3c7b5e0d1f9a',
    blockHeight: 21490841,
    sourceEntity: 'Sovereign Treasury Reserve #09',
    destinationEntity: 'BlackRock Tokenized T-Bill Fund',
    amountUsd: 25000000,
    assetSymbol: 'T-BILL',
    riskLevel: 'WARNING',
    riskScore: 54,
    status: 'PENDING_AUDIT',
    threatVector: 'Whale Liquidity Movement (> $10M) · Manual Multi-Sig Required',
    createdAtIso: '2026-11-04T21:35:02.000Z',
    updatedAtIso: '2026-11-04T21:35:02.000Z',
  },
  {
    id: 'seed_tx_05',
    ownerId: 'system_seed',
    txHash: '0x1d6f3c8a9b2e407d5f1a8c3e9b0d2f4a7c6e8b1d',
    blockHeight: 21490838,
    sourceEntity: 'Lazarus Cluster Shadow Hop 04',
    destinationEntity: 'Anonymous Mixer Pool #12',
    amountUsd: 9120000,
    assetSymbol: 'ETH',
    riskLevel: 'CRITICAL',
    riskScore: 94,
    status: 'QUARANTINED',
    threatVector: 'Sanctioned Entity Graph Overlap · Mixer Deposit',
    createdAtIso: '2026-11-04T21:28:49.000Z',
    updatedAtIso: '2026-11-04T21:29:01.000Z',
  },
  {
    id: 'seed_tx_06',
    ownerId: 'system_seed',
    txHash: '0x8a3c5e7f1b9d204a6c8e0f2b4d6a8c0e2f4a6b8d',
    blockHeight: 21490835,
    sourceEntity: 'Wintermute Institutional DMA',
    destinationEntity: 'Apex Euro-Clear Settlement Node',
    amountUsd: 1420000,
    assetSymbol: 'USDP',
    riskLevel: 'NOMINAL',
    riskScore: 16,
    status: 'SETTLED',
    threatVector: 'Verified Custody Settlement Corridor',
    createdAtIso: '2026-11-04T21:19:11.000Z',
    updatedAtIso: '2026-11-04T21:19:45.000Z',
  },
];

export type GlassFinishId = 'sapphire' | 'quartz' | 'obsidian' | 'ruby';
export type CameraPresetId = 'orbit' | 'macro' | 'top' | 'isometric';
export type GlyphWordId = 'APEX' | 'VAULT' | 'ZERO';
export type ChatTaskTier = 'complex' | 'general' | 'fast';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed: string;
  taskTier: ChatTaskTier;
  thinkingLevel?: string;
  timestampIso: string;
}

export interface GlassFinishSpec {
  id: GlassFinishId;
  label: string;
  colorHex: number;
  attenuationHex: number;
  emissiveHex: number;
  ior: number;
  roughness: number;
  clearcoat: number;
}

export const GLASS_FINISH_SPECS: Record<GlassFinishId, GlassFinishSpec> = {
  sapphire: {
    id: 'sapphire',
    label: 'Sapphire Optical',
    colorHex: 0xd8e8ff,
    attenuationHex: 0x3b82f6,
    emissiveHex: 0x0d285a,
    ior: 1.76,
    roughness: 0.06,
    clearcoat: 1.0,
  },
  quartz: {
    id: 'quartz',
    label: 'Dichroic Quartz',
    colorHex: 0xf0f6ff,
    attenuationHex: 0x60a5fa,
    emissiveHex: 0x1e3a8a,
    ior: 1.55,
    roughness: 0.04,
    clearcoat: 1.0,
  },
  obsidian: {
    id: 'obsidian',
    label: 'Smoked Obsidian',
    colorHex: 0x64748b,
    attenuationHex: 0x1e293b,
    emissiveHex: 0x091326,
    ior: 1.62,
    roughness: 0.12,
    clearcoat: 0.9,
  },
  ruby: {
    id: 'ruby',
    label: 'Crimson Threat',
    colorHex: 0xffd6d6,
    attenuationHex: 0xef4444,
    emissiveHex: 0x450a0a,
    ior: 1.82,
    roughness: 0.07,
    clearcoat: 1.0,
  },
};

export function resolveChatModelConfig(tier: ChatTaskTier): {
  model: 'gemini-4-argon' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';
  thinkingLevel?: 'HIGH';
  label: string;
} {
  if (tier === 'complex') {
    return {
      model: 'gemini-4-argon',
      thinkingLevel: 'HIGH',
      label: 'Complex Reasoning (gemini-4-argon · HIGH)',
    };
  }
  if (tier === 'fast') {
    return {
      model: 'gemini-3.1-flash-lite',
      label: 'Fast Response (gemini-3.1-flash-lite)',
    };
  }
  return {
    model: 'gemini-3.8-flash',
    label: 'General Analysis (gemini-3.8-flash)',
  };
}

