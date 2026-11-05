import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  validateNewLedgerInput,
  type AssetSymbol,
  type ValidationResult,
} from '../utils/ledgerLogic';

interface RecordEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBlockHeight: number;
  onSubmitValidEntry: (sanitized: NonNullable<ValidationResult['sanitized']>) => Promise<void>;
}

const ASSET_OPTIONS: AssetSymbol[] = ['USDC', 'BTC', 'ETH', 'USDP', 'T-BILL'];

export function RecordEntryModal({
  isOpen,
  onClose,
  currentBlockHeight,
  onSubmitValidEntry,
}: RecordEntryModalProps) {
  const [sourceEntity, setSourceEntity] = useState('');
  const [destinationEntity, setDestinationEntity] = useState('');
  const [amountUsdRaw, setAmountUsdRaw] = useState('');
  const [assetSymbol, setAssetSymbol] = useState<AssetSymbol>('USDC');
  const [customTxHash, setCustomTxHash] = useState('');
  const [customThreatNote, setCustomThreatNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePresetFill = (preset: 'nominal' | 'critical') => {
    setErrors({});
    if (preset === 'nominal') {
      setSourceEntity('Apex Institutional Custody #02');
      setDestinationEntity('Swiss National Settlement Vault');
      setAmountUsdRaw('1850000');
      setAssetSymbol('USDC');
      setCustomTxHash('');
      setCustomThreatNote('Verified Institutional Liquidity Corridor');
    } else {
      setSourceEntity('Cross-Chain Exploit Proxy 0x99A');
      setDestinationEntity('Unverified Offshore Mixer Relay');
      setAmountUsdRaw('14200000');
      setAssetSymbol('ETH');
      setCustomTxHash('');
      setCustomThreatNote('Anomalous Flash-Loan Drain · High Velocity');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateNewLedgerInput(
      {
        sourceEntity,
        destinationEntity,
        amountUsdRaw,
        assetSymbol,
        customTxHash,
        customThreatNote,
      },
      currentBlockHeight
    );

    if (!validation.valid || !validation.sanitized) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await onSubmitValidEntry(validation.sanitized);
      setSourceEntity('');
      setDestinationEntity('');
      setAmountUsdRaw('');
      setAssetSymbol('USDC');
      setCustomTxHash('');
      setCustomThreatNote('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
    >
      <div className="w-full max-w-xl rounded-lg border border-[#3b82f6]/40 bg-[#0f172a] p-6 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
        <div className="flex items-center justify-between border-b border-[#222a3d] pb-4">
          <div>
            <h2 id="record-modal-title" className="text-lg font-semibold text-[#dae2fd]">
              Record Cryptographic Ledger Entry
            </h2>
            <p className="mt-0.5 text-xs text-[#8c909f]">
              Ingest a settlement block for deterministic risk scoring and Firestore audit persistence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Record Ledger Entry modal"
            className="rounded border border-[#222a3d] p-1.5 text-[#8c909f] transition-colors hover:border-[#424754] hover:text-[#dae2fd]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded border border-[#222a3d] bg-[#0b1326] px-3 py-2">
          <span className="text-xs text-[#c2c6d6]">Quick Simulation Templates:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePresetFill('nominal')}
              className="rounded border border-[#222a3d] bg-[#131b2e] px-2.5 py-1 text-xs font-medium text-[#dae2fd] transition-colors hover:border-[#3b82f6] whitespace-nowrap shrink-0"
            >
              Load Nominal Settlement
            </button>
            <button
              type="button"
              onClick={() => handlePresetFill('critical')}
              className="rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2.5 py-1 text-xs font-medium text-[#ffb3ad] transition-colors hover:border-[#ef4444] whitespace-nowrap shrink-0"
            >
              Load Critical Exploit Vector
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="input-source-entity"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Originating Vault / Source Entity *
              </label>
              <input
                id="input-source-entity"
                type="text"
                value={sourceEntity}
                onChange={(e) => setSourceEntity(e.target.value)}
                placeholder="e.g. Apex Custody Vault #04"
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 text-sm text-[#dae2fd] placeholder-[#8c909f]/60 focus:border-[#3b82f6] focus:outline-none"
              />
              {errors.sourceEntity && (
                <p role="alert" className="mt-1 text-xs text-[#ef4444]">
                  {errors.sourceEntity}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="input-dest-entity"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Receiving Counterparty / Bridge *
              </label>
              <input
                id="input-dest-entity"
                type="text"
                value={destinationEntity}
                onChange={(e) => setDestinationEntity(e.target.value)}
                placeholder="e.g. Zurich Prime Settlement"
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 text-sm text-[#dae2fd] placeholder-[#8c909f]/60 focus:border-[#3b82f6] focus:outline-none"
              />
              {errors.destinationEntity && (
                <p role="alert" className="mt-1 text-xs text-[#ef4444]">
                  {errors.destinationEntity}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="input-amount-usd"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Settlement Value (USD) *
              </label>
              <input
                id="input-amount-usd"
                type="number"
                step="any"
                value={amountUsdRaw}
                onChange={(e) => setAmountUsdRaw(e.target.value)}
                placeholder="2500000"
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 font-mono text-sm text-[#dae2fd] placeholder-[#8c909f]/60 focus:border-[#3b82f6] focus:outline-none tabular-nums"
              />
              {errors.amountUsdRaw && (
                <p role="alert" className="mt-1 text-xs text-[#ef4444]">
                  {errors.amountUsdRaw}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="input-asset-symbol"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Settlement Asset
              </label>
              <select
                id="input-asset-symbol"
                value={assetSymbol}
                onChange={(e) => setAssetSymbol(e.target.value as AssetSymbol)}
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 font-mono text-sm text-[#dae2fd] focus:border-[#3b82f6] focus:outline-none"
              >
                {ASSET_OPTIONS.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="input-tx-hash" className="block text-xs font-medium text-[#c2c6d6]">
                Cryptographic Hash (Optional — auto-derived if blank)
              </label>
              <input
                id="input-tx-hash"
                type="text"
                value={customTxHash}
                onChange={(e) => setCustomTxHash(e.target.value)}
                placeholder="0x8f9c2b..."
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 font-mono text-xs text-[#dae2fd] placeholder-[#8c909f]/60 focus:border-[#3b82f6] focus:outline-none"
              />
              {errors.customTxHash && (
                <p role="alert" className="mt-1 text-xs text-[#ef4444]">
                  {errors.customTxHash}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="input-threat-note"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Telemetry / Threat Signature Note
              </label>
              <input
                id="input-threat-note"
                type="text"
                value={customThreatNote}
                onChange={(e) => setCustomThreatNote(e.target.value)}
                placeholder="e.g. Cross-Chain Arbitrage Settlement"
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 text-sm text-[#dae2fd] placeholder-[#8c909f]/60 focus:border-[#3b82f6] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#222a3d] pt-4">
            <span className="font-mono text-xs text-[#8c909f] tabular-nums">
              Target Block: #{currentBlockHeight + 1}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-[#222a3d] bg-transparent px-4 py-2 text-xs font-medium text-[#c2c6d6] transition-colors hover:border-[#424754] hover:text-[#dae2fd] whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#60a5fa] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isSubmitting ? 'Committing Block...' : 'Commit to Ledger'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
