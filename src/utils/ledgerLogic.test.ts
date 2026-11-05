import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNewLedgerInput,
  evaluateTransactionRisk,
  filterLedgerEntries,
  computeLedgerMetrics,
  buildDeterministicForensicReport,
  INITIAL_SEED_LEDGER,
  resolveChatModelConfig,
  GLASS_FINISH_SPECS,
} from './ledgerLogic';

test('resolveChatModelConfig maps complex, general, and fast tiers to required Gemini models', () => {
  const complexCfg = resolveChatModelConfig('complex');
  assert.equal(complexCfg.model, 'gemini-4-argon');
  assert.equal(complexCfg.thinkingLevel, 'HIGH');

  const generalCfg = resolveChatModelConfig('general');
  assert.equal(generalCfg.model, 'gemini-3.8-flash');
  assert.equal(generalCfg.thinkingLevel, undefined);

  const fastCfg = resolveChatModelConfig('fast');
  assert.equal(fastCfg.model, 'gemini-3.1-flash-lite');

  assert.equal(GLASS_FINISH_SPECS.sapphire.ior, 1.76);
  assert.equal(GLASS_FINISH_SPECS.ruby.attenuationHex, 0xef4444);
});

test('validateNewLedgerInput rejects empty or invalid inputs and never uses silent fallbacks', () => {
  const emptyRes = validateNewLedgerInput({
    sourceEntity: '',
    destinationEntity: '',
    amountUsdRaw: '',
    assetSymbol: 'USDC',
  });
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.sourceEntity);
  assert.ok(emptyRes.errors.destinationEntity);
  assert.ok(emptyRes.errors.amountUsdRaw);

  const selfLoopRes = validateNewLedgerInput({
    sourceEntity: 'Apex Vault #1',
    destinationEntity: 'apex vault #1',
    amountUsdRaw: '50000',
    assetSymbol: 'USDC',
  });
  assert.equal(selfLoopRes.valid, false);
  assert.match(selfLoopRes.errors.destinationEntity, /identical/);

  const badHashRes = validateNewLedgerInput({
    sourceEntity: 'Apex Vault #1',
    destinationEntity: 'Zurich Custody',
    amountUsdRaw: '50000',
    assetSymbol: 'USDC',
    customTxHash: 'not_a_hex_hash',
  });
  assert.equal(badHashRes.valid, false);
  assert.ok(badHashRes.errors.customTxHash);
});

test('validateNewLedgerInput sanitizes valid input and computes deterministic hash and risk', () => {
  const validRes = validateNewLedgerInput(
    {
      sourceEntity: 'Exploit Drainer Proxy',
      destinationEntity: 'Offshore Tornado Mixer',
      amountUsdRaw: '15000000',
      assetSymbol: 'ETH',
    },
    21490900
  );
  assert.equal(validRes.valid, true);
  assert.ok(validRes.sanitized);
  assert.match(validRes.sanitized.txHash, /^0x[a-f0-9]{40}$/);
  assert.equal(validRes.sanitized.blockHeight, 21490901);
  assert.equal(validRes.sanitized.riskLevel, 'CRITICAL');
  assert.equal(validRes.sanitized.status, 'QUARANTINED');
  assert.ok(validRes.sanitized.riskScore >= 75);
});

test('evaluateTransactionRisk classifies nominal vs critical settlements accurately', () => {
  const nominal = evaluateTransactionRisk({
    sourceEntity: 'Apex Custody Desk',
    destinationEntity: 'Fidelity Prime Settlement',
    amountUsd: 120000,
    assetSymbol: 'USDC',
  });
  assert.equal(nominal.riskLevel, 'NOMINAL');
  assert.ok(nominal.riskScore < 40);

  const critical = evaluateTransactionRisk({
    sourceEntity: 'Bridge Exploit Address',
    destinationEntity: 'Anon Mixer Pool',
    amountUsd: 12000000,
    assetSymbol: 'ETH',
  });
  assert.equal(critical.riskLevel, 'CRITICAL');
  assert.equal(critical.status, 'QUARANTINED');
});

test('filterLedgerEntries and computeLedgerMetrics calculate accurate counts and volumes', () => {
  const criticalOnly = filterLedgerEntries(INITIAL_SEED_LEDGER, {
    riskFilter: 'CRITICAL',
    statusFilter: 'ALL',
    searchQuery: '',
  });
  assert.equal(criticalOnly.length, 2);

  const searchMatch = filterLedgerEntries(INITIAL_SEED_LEDGER, {
    riskFilter: 'ALL',
    statusFilter: 'ALL',
    searchQuery: 'BlackRock',
  });
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].assetSymbol, 'T-BILL');

  const metrics = computeLedgerMetrics(INITIAL_SEED_LEDGER);
  assert.equal(metrics.criticalCount, 2);
  assert.equal(metrics.warningCount, 2);
  assert.equal(metrics.settledCount, 2);
  assert.ok(metrics.totalVolumeUsd > 60_000_000);
});

test('buildDeterministicForensicReport returns structured high-thinking forensic synthesis', () => {
  const report = buildDeterministicForensicReport({
    txHash: INITIAL_SEED_LEDGER[0].txHash,
    queryPrompt: 'Analyze multi-hop flash loan reentrancy risk and mixer exposure.',
    entry: INITIAL_SEED_LEDGER[0],
  });
  assert.equal(report.verdict, 'CRITICAL_THREAT');
  assert.equal(report.modelUsed, 'gemini-4-argon');
  assert.equal(report.thinkingLevel, 'HIGH');
  assert.equal(report.reasoningSteps.length, 3);
  assert.ok(report.recommendedActions.length >= 2);
});
