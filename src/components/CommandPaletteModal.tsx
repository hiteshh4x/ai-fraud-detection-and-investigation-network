import React, { useState } from 'react';
import { Search, Terminal, ArrowRight, X, Shield, Cpu, FileSpreadsheet } from 'lucide-react';
import type { LedgerEntryItem } from '../utils/ledgerLogic';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LedgerEntryItem[];
  onNavigateTab: (tab: 'ledger' | 'threats' | 'forensics' | 'rules') => void;
  onSelectEntryForForensics: (entry: LedgerEntryItem) => void;
  onOpenRecordModal: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  entries,
  onNavigateTab,
  onSelectEntryForForensics,
  onOpenRecordModal,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const matchingEntries = entries
    .filter(
      (e) =>
        q.length === 0 ||
        e.txHash.toLowerCase().includes(q) ||
        e.sourceEntity.toLowerCase().includes(q) ||
        e.destinationEntity.toLowerCase().includes(q) ||
        e.threatVector.toLowerCase().includes(q)
    )
    .slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 pt-20 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-palette-title"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[#3b82f6]/50 bg-[#0f172a] shadow-[0_0_45px_rgba(59,130,246,0.2)]">
        <div className="flex items-center gap-3 border-b border-[#222a3d] px-4 py-3">
          <Search className="h-4 w-4 text-[#60a5fa] shrink-0" />
          <input
            type="text"
            aria-label="Command palette search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to hash (0x...), counterparty desk, or execute security directive..."
            autoFocus
            className="w-full bg-transparent text-sm text-[#dae2fd] placeholder-[#8c909f] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Command Palette"
            className="rounded border border-[#222a3d] px-2 py-1 font-mono text-xs text-[#8c909f] hover:border-[#424754] hover:text-[#dae2fd]"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 id="cmd-palette-title" className="text-xs font-semibold text-[#8c909f]">
              Quick Workspace Directives
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRecordModal();
                }}
                className="flex items-center justify-between rounded border border-[#222a3d] bg-[#131b2e] px-3 py-2 text-left text-xs text-[#dae2fd] transition-colors hover:border-[#3b82f6]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-[#60a5fa]" />
                  Record New Ledger Entry
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#8c909f]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab('forensics');
                  onClose();
                }}
                className="flex items-center justify-between rounded border border-[#222a3d] bg-[#131b2e] px-3 py-2 text-left text-xs text-[#dae2fd] transition-colors hover:border-[#3b82f6]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Cpu className="h-3.5 w-3.5 text-[#60a5fa]" />
                  Open High-Thinking Forensic AI Lab
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#8c909f]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab('threats');
                  onClose();
                }}
                className="flex items-center justify-between rounded border border-[#222a3d] bg-[#131b2e] px-3 py-2 text-left text-xs text-[#dae2fd] transition-colors hover:border-[#3b82f6]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Shield className="h-3.5 w-3.5 text-[#ef4444]" />
                  Inspect Active Threat Matrix
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#8c909f]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab('rules');
                  onClose();
                }}
                className="flex items-center justify-between rounded border border-[#222a3d] bg-[#131b2e] px-3 py-2 text-left text-xs text-[#dae2fd] transition-colors hover:border-[#3b82f6]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Terminal className="h-3.5 w-3.5 text-[#f59e0b]" />
                  Audit Zero-Trust Firestore Rules
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#8c909f]" />
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#8c909f]">
              Matching Ledger Hashes &amp; Counterparties ({matchingEntries.length})
            </h4>
            <div className="mt-2 divide-y divide-[#222a3d] rounded border border-[#222a3d] bg-[#0b0f19]">
              {matchingEntries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectEntryForForensics(item);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#171f33]"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#60a5fa] truncate">
                        {item.txHash.slice(0, 22)}...
                      </span>
                      <span className="text-xs text-[#8c909f]">·</span>
                      <span className="text-xs font-medium text-[#dae2fd] truncate">
                        {item.sourceEntity} → {item.destinationEntity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#8c909f] truncate">{item.threatVector}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-medium text-[#dae2fd] tabular-nums">
                      ${item.amountUsd.toLocaleString('en-US')} {item.assetSymbol}
                    </div>
                    <div
                      className={`font-mono text-[11px] ${
                        item.riskLevel === 'CRITICAL'
                          ? 'text-[#ef4444]'
                          : item.riskLevel === 'WARNING'
                            ? 'text-[#f59e0b]'
                            : 'text-[#60a5fa]'
                      }`}
                    >
                      Risk {item.riskScore}/100
                    </div>
                  </div>
                </button>
              ))}
              {matchingEntries.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-[#8c909f]">
                  No ledger entries match "{query}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
