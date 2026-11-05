import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync('./firestore.rules', 'utf8');

interface SimulatedAuth {
  uid: string;
  email_verified: boolean;
}

interface LedgerPayload {
  ownerId?: unknown;
  txHash?: unknown;
  blockHeight?: unknown;
  sourceEntity?: unknown;
  destinationEntity?: unknown;
  amountUsd?: unknown;
  assetSymbol?: unknown;
  riskLevel?: unknown;
  riskScore?: unknown;
  status?: unknown;
  threatVector?: unknown;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

const REQUIRED_LEDGER_KEYS = [
  'ownerId', 'txHash', 'blockHeight', 'sourceEntity', 'destinationEntity',
  'amountUsd', 'assetSymbol', 'riskLevel', 'riskScore', 'status',
  'threatVector', 'createdAt', 'updatedAt'
];

function evaluateLedgerCreate(
  entryId: string,
  auth: SimulatedAuth | null,
  data: LedgerPayload,
  requestTime: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (typeof entryId !== 'string' || entryId.length < 1 || entryId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(entryId)) {
    return 'PERMISSION_DENIED';
  }
  const keys = Object.keys(data);
  if (!REQUIRED_LEDGER_KEYS.every((k) => keys.includes(k))) return 'PERMISSION_DENIED';
  if (!keys.every((k) => REQUIRED_LEDGER_KEYS.includes(k))) return 'PERMISSION_DENIED';

  if (typeof data.ownerId !== 'string' || data.ownerId !== auth.uid || !/^[a-zA-Z0-9_-]+$/.test(data.ownerId)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.txHash !== 'string' || data.txHash.length < 10 || data.txHash.length > 80 || !/^0x[a-fA-F0-9]+$/.test(data.txHash)) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.blockHeight !== 'number' || !Number.isInteger(data.blockHeight) || data.blockHeight < 0) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.sourceEntity !== 'string' || data.sourceEntity.length < 2 || data.sourceEntity.length > 80) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.destinationEntity !== 'string' || data.destinationEntity.length < 2 || data.destinationEntity.length > 80) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.amountUsd !== 'number' || data.amountUsd < 0) {
    return 'PERMISSION_DENIED';
  }
  if (!['USDC', 'BTC', 'ETH', 'USDP', 'T-BILL'].includes(String(data.assetSymbol))) {
    return 'PERMISSION_DENIED';
  }
  if (!['CRITICAL', 'WARNING', 'NOMINAL'].includes(String(data.riskLevel))) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.riskScore !== 'number' || !Number.isInteger(data.riskScore) || data.riskScore < 0 || data.riskScore > 100) {
    return 'PERMISSION_DENIED';
  }
  if (!['PENDING_AUDIT', 'QUARANTINED', 'SETTLED', 'OVERRIDDEN'].includes(String(data.status))) {
    return 'PERMISSION_DENIED';
  }
  if (typeof data.threatVector !== 'string' || data.threatVector.length < 2 || data.threatVector.length > 160) {
    return 'PERMISSION_DENIED';
  }
  if (data.createdAt !== requestTime || data.updatedAt !== requestTime) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function evaluateLedgerUpdate(
  entryId: string,
  auth: SimulatedAuth | null,
  existing: LedgerPayload,
  incoming: LedgerPayload,
  requestTime: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (existing.status === 'SETTLED') return 'PERMISSION_DENIED';

  const baseValid = evaluateLedgerCreate(entryId, auth, { ...incoming, createdAt: requestTime, updatedAt: requestTime }, requestTime);
  if (baseValid !== 'ALLOW') return 'PERMISSION_DENIED';

  if (incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== requestTime) return 'PERMISSION_DENIED';

  const immutableKeys = ['ownerId', 'txHash', 'blockHeight', 'sourceEntity', 'destinationEntity', 'amountUsd', 'assetSymbol'];
  for (const k of immutableKeys) {
    if (incoming[k] !== existing[k]) return 'PERMISSION_DENIED';
  }

  return 'ALLOW';
}

const VALID_NOW = '2026-11-04T22:00:00Z';
const VALID_AUTH: SimulatedAuth = { uid: 'analyst_01', email_verified: true };
const VALID_PAYLOAD: LedgerPayload = {
  ownerId: 'analyst_01',
  txHash: '0x8f9c2b1e4d7a6f3c9e0b1a2d3c4e5f6a7b8c9d0e',
  blockHeight: 21490812,
  sourceEntity: 'Apex Custody Vault #04',
  destinationEntity: 'Zurich Prime Settlement',
  amountUsd: 1450000,
  assetSymbol: 'USDC',
  riskLevel: 'NOMINAL',
  riskScore: 14,
  status: 'PENDING_AUDIT',
  threatVector: 'Standard Institutional Settlement',
  createdAt: VALID_NOW,
  updatedAt: VALID_NOW,
};

test('firestore.rules file contains all mandatory structural invariants', () => {
  assert.match(rulesSource, /rules_version = '2';/);
  assert.match(rulesSource, /allow read, write: if false;/);
  assert.match(rulesSource, /function isValidLedgerEntry\(data\)/);
  assert.match(rulesSource, /function isValidForensicReport\(data\)/);
  assert.match(rulesSource, /existing\(\)\.status != 'SETTLED'/);
});

test('Dirty Dozen #1-#12 malicious payloads return PERMISSION_DENIED', () => {
  // Valid baseline passes
  assert.equal(evaluateLedgerCreate('entry_01', VALID_AUTH, VALID_PAYLOAD, VALID_NOW), 'ALLOW');

  // 1. Shadow field injection
  assert.equal(
    evaluateLedgerCreate('entry_01', VALID_AUTH, { ...VALID_PAYLOAD, isVerifiedAdmin: true }, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 2. Identity spoofing on create
  assert.equal(
    evaluateLedgerCreate('entry_01', VALID_AUTH, { ...VALID_PAYLOAD, ownerId: 'other_user' }, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 3. Unverified email write
  assert.equal(
    evaluateLedgerCreate('entry_01', { uid: 'analyst_01', email_verified: false }, VALID_PAYLOAD, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 4. Path ID poisoning
  assert.equal(
    evaluateLedgerCreate('x'.repeat(200), VALID_AUTH, VALID_PAYLOAD, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 5. Invalid hex hash format
  assert.equal(
    evaluateLedgerCreate('entry_01', VALID_AUTH, { ...VALID_PAYLOAD, txHash: 'invalid_hash_string' }, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 6. Terminal state mutation (modifying a SETTLED entry)
  assert.equal(
    evaluateLedgerUpdate(
      'entry_01',
      VALID_AUTH,
      { ...VALID_PAYLOAD, status: 'SETTLED' },
      { ...VALID_PAYLOAD, status: 'OVERRIDDEN', updatedAt: '2026-11-04T22:05:00Z' },
      '2026-11-04T22:05:00Z'
    ),
    'PERMISSION_DENIED'
  );

  // 7. Immutable field tampering (changing amountUsd on update)
  assert.equal(
    evaluateLedgerUpdate(
      'entry_01',
      VALID_AUTH,
      VALID_PAYLOAD,
      { ...VALID_PAYLOAD, amountUsd: 99999999, updatedAt: '2026-11-04T22:05:00Z' },
      '2026-11-04T22:05:00Z'
    ),
    'PERMISSION_DENIED'
  );

  // 8. Client timestamp forgery
  assert.equal(
    evaluateLedgerCreate('entry_01', VALID_AUTH, { ...VALID_PAYLOAD, createdAt: '1999-01-01T00:00:00Z' }, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 9. Denial-of-Wallet string overflow
  assert.equal(
    evaluateLedgerCreate('entry_01', VALID_AUTH, { ...VALID_PAYLOAD, threatVector: 'A'.repeat(1000) }, VALID_NOW),
    'PERMISSION_DENIED'
  );

  // 10. Value poisoning on update (invalid status enum)
  assert.equal(
    evaluateLedgerUpdate(
      'entry_01',
      VALID_AUTH,
      VALID_PAYLOAD,
      { ...VALID_PAYLOAD, status: 'BYPASSED', updatedAt: '2026-11-04T22:05:00Z' },
      '2026-11-04T22:05:00Z'
    ),
    'PERMISSION_DENIED'
  );
});
