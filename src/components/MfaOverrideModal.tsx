import React, { useState } from 'react';
import { ShieldAlert, KeyRound, X } from 'lucide-react';
import type { LedgerEntryItem, LedgerStatus } from '../utils/ledgerLogic';

interface MfaOverrideModalProps {
  isOpen: boolean;
  entry: LedgerEntryItem | null;
  targetStatus: LedgerStatus;
  onClose: () => void;
  onConfirmOverride: (entry: LedgerEntryItem, newStatus: LedgerStatus, reason: string) => Promise<void>;
}

export function MfaOverrideModal({
  isOpen,
  entry,
  targetStatus,
  onClose,
  onConfirmOverride,
}: MfaOverrideModalProps) {
  const [totpCode, setTotpCode] = useState('849201');
  const [justification, setJustification] = useState(
    'Verified institutional liquidity attestation via out-of-band hardware HSM.'
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !entry) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(totpCode.trim())) {
      setError('Enter a valid 6-digit hardware authenticator code.');
      return;
    }
    if (justification.trim().length < 6) {
      setError('Provide an audit justification (at least 6 characters).');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirmOverride(entry, targetStatus, justification.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[#ef4444]/60 bg-[#0f172a] p-6 shadow-[0_0_45px_rgba(239,68,68,0.2)]">
        <div className="flex items-start justify-between border-b border-[#222a3d] pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-[#ef4444] shrink-0" />
            <div>
              <h2 id="mfa-modal-title" className="text-base font-semibold text-[#dae2fd]">
                Multi-Factor Cryptographic Override
              </h2>
              <p className="text-xs text-[#8c909f]">
                L3 Security Architect signature required for state transition
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close MFA modal"
            className="rounded border border-[#222a3d] p-1 text-[#8c909f] hover:text-[#dae2fd]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="mt-4 space-y-4">
          <div className="rounded border border-[#222a3d] bg-[#0b0f19] p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#8c909f]">Target Hash:</span>
              <span className="font-mono text-[#60a5fa]">{entry.txHash.slice(0, 20)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8c909f]">Counterparty:</span>
              <span className="text-[#dae2fd]">{entry.destinationEntity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8c909f]">State Transition:</span>
              <span className="font-mono font-semibold text-[#f59e0b]">
                {entry.status} → {targetStatus}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="mfa-totp-input" className="block text-xs font-medium text-[#c2c6d6]">
              Hardware Token / YubiKey 6-Digit OTP
            </label>
            <div className="relative mt-1.5">
              <input
                id="mfa-totp-input"
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 font-mono text-sm tracking-widest text-[#dae2fd] focus:border-[#ef4444] focus:outline-none tabular-nums"
              />
              <KeyRound className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#8c909f]" />
            </div>
          </div>

          <div>
            <label htmlFor="mfa-reason-input" className="block text-xs font-medium text-[#c2c6d6]">
              Immutable Audit Log Justification
            </label>
            <textarea
              id="mfa-reason-input"
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] p-2.5 text-xs text-[#dae2fd] focus:border-[#3b82f6] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-[#ef4444]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[#222a3d] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#222a3d] px-3.5 py-2 text-xs font-medium text-[#c2c6d6] hover:border-[#424754] whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-[#ef4444] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#dc2626] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Signing Directive...' : `Authorize ${targetStatus}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
