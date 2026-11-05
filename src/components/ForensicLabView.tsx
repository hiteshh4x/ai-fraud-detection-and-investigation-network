import React, { useState } from 'react';
import {
  Cpu,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  BookmarkCheck,
  Play,
  Layers,
} from 'lucide-react';
import {
  buildDeterministicForensicReport,
  type ForensicAnalysisResult,
  type LedgerEntryItem,
} from '../utils/ledgerLogic';

interface ForensicLabViewProps {
  entries: LedgerEntryItem[];
  selectedEntry: LedgerEntryItem;
  onSelectEntry: (entry: LedgerEntryItem) => void;
  savedReports: ForensicAnalysisResult[];
  onSaveReportToFirestore: (report: ForensicAnalysisResult) => Promise<void>;
  onApplyRecommendedStatus: (entry: LedgerEntryItem, status: LedgerEntryItem['status']) => void;
}

const PRESET_QUERIES = [
  'Decompose 4-hop UTXO/account ancestry for flash-loan reentrancy and zero-knowledge mixer exposure.',
  'Evaluate OFAC sanctions graph overlap and cross-chain bridge validator signature entropy.',
  'Simulate post-settlement institutional vault liquidity ratio and slippage contagion across L2 relays.',
];

export function ForensicLabView({
  entries,
  selectedEntry,
  onSelectEntry,
  savedReports,
  onSaveReportToFirestore,
  onApplyRecommendedStatus,
}: ForensicLabViewProps) {
  const [queryPrompt, setQueryPrompt] = useState(PRESET_QUERIES[0]);
  const [activeReport, setActiveReport] = useState<ForensicAnalysisResult>(() =>
    buildDeterministicForensicReport({
      txHash: selectedEntry.txHash,
      queryPrompt: PRESET_QUERIES[0],
      entry: selectedEntry,
    })
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  const handleRunHighThinkingAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (queryPrompt.trim().length < 4) return;

    setIsAnalyzing(true);
    setSaveFeedback('');
    try {
      const response = await fetch('/api/forensics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: selectedEntry.txHash,
          queryPrompt: queryPrompt.trim(),
          entry: selectedEntry,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as ForensicAnalysisResult;
      setActiveReport(data);
    } catch {
      const fallback = buildDeterministicForensicReport({
        txHash: selectedEntry.txHash,
        queryPrompt: queryPrompt.trim(),
        entry: selectedEntry,
      });
      setActiveReport(fallback);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      await onSaveReportToFirestore(activeReport);
      setSaveFeedback('Forensic report committed to audit store.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left 5 columns: Target Selection & High-Thinking Query Configuration */}
      <div className="space-y-6 lg:col-span-5">
        <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5">
          <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#dae2fd]">
                High-Thinking Forensic AI Engine
              </h2>
              <p className="mt-0.5 text-xs text-[#8c909f]">
                Model: <span className="font-mono text-[#60a5fa]">gemini-4-argon</span> ·{' '}
                <span className="font-mono text-[#dae2fd]">ThinkingLevel.HIGH</span>
              </p>
            </div>
            <Cpu className="h-5 w-5 text-[#3b82f6]" />
          </div>

          <form onSubmit={handleRunHighThinkingAnalysis} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="forensic-target-select"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Target Settlement Hash
              </label>
              <select
                id="forensic-target-select"
                value={selectedEntry.id}
                onChange={(e) => {
                  const found = entries.find((item) => item.id === e.target.value);
                  if (found) {
                    onSelectEntry(found);
                    setActiveReport(
                      buildDeterministicForensicReport({
                        txHash: found.txHash,
                        queryPrompt,
                        entry: found,
                      })
                    );
                  }
                }}
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] px-3 py-2 font-mono text-xs text-[#dae2fd] focus:border-[#3b82f6] focus:outline-none"
              >
                {entries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.txHash.slice(0, 18)}... — {item.sourceEntity} ($
                    {item.amountUsd.toLocaleString('en-US')} {item.assetSymbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="forensic-query-textarea"
                className="block text-xs font-medium text-[#c2c6d6]"
              >
                Deep Forensic Reasoning Directive
              </label>
              <textarea
                id="forensic-query-textarea"
                rows={3}
                value={queryPrompt}
                onChange={(e) => setQueryPrompt(e.target.value)}
                className="mt-1.5 w-full rounded border border-[#222a3d] bg-[#0b0f19] p-3 text-xs leading-relaxed text-[#dae2fd] focus:border-[#3b82f6] focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_QUERIES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQueryPrompt(preset)}
                    className="rounded border border-[#222a3d] bg-[#131b2e] px-2.5 py-1 text-left text-[11px] text-[#c2c6d6] transition-colors hover:border-[#3b82f6] hover:text-[#dae2fd]"
                  >
                    Preset #{idx + 1}: {preset.slice(0, 44)}...
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="font-mono text-xs text-[#8c909f] tabular-nums">
                Block #{selectedEntry.blockHeight} · Risk {selectedEntry.riskScore}/100
              </span>
              <button
                type="submit"
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 rounded bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#60a5fa] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" />
                {isAnalyzing ? 'Synthesizing Deep Trace...' : 'Execute High-Thinking Trace'}
              </button>
            </div>
          </form>
        </section>

        {/* Archived Forensic Reports */}
        <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5">
          <h3 className="text-sm font-semibold text-[#dae2fd]">
            Committed Forensic Audit Reports ({savedReports.length})
          </h3>
          <p className="mt-0.5 text-xs text-[#8c909f]">
            Persisted in Firestore <code className="font-mono">/forensic_reports</code> collection
          </p>

          <div className="mt-3 divide-y divide-[#222a3d] rounded border border-[#222a3d] bg-[#0b0f19]">
            {savedReports.slice(0, 4).map((rep, idx) => (
              <button
                key={`${rep.txHash}-${idx}`}
                type="button"
                onClick={() => setActiveReport(rep)}
                className="flex w-full items-start justify-between p-3 text-left transition-colors hover:bg-[#171f33]"
              >
                <div className="min-w-0 pr-3">
                  <div className="font-mono text-xs text-[#60a5fa] truncate">
                    {rep.txHash.slice(0, 24)}...
                  </div>
                  <p className="mt-1 text-xs text-[#c2c6d6] line-clamp-1">{rep.summary}</p>
                </div>
                <span
                  className={`font-mono text-[11px] font-semibold shrink-0 ${
                    rep.verdict === 'CRITICAL_THREAT'
                      ? 'text-[#ef4444]'
                      : rep.verdict === 'ELEVATED_RISK'
                        ? 'text-[#f59e0b]'
                        : 'text-[#60a5fa]'
                  }`}
                >
                  {rep.verdict}
                </span>
              </button>
            ))}
            {savedReports.length === 0 && (
              <div className="p-4 text-center text-xs text-[#8c909f]">
                No committed forensic reports yet. Run a trace and click "Commit Report".
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right 7 columns: Active Reasoning Trace & Vector Decomposition */}
      <div className="space-y-6 lg:col-span-7">
        <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#222a3d] pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#8c909f]">
                <span className="font-mono text-[#60a5fa]">{activeReport.modelUsed}</span>
                <span>·</span>
                <span className="font-mono">Thinking: {activeReport.thinkingLevel}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  Score: {activeReport.riskScore}/100
                </span>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-[#dae2fd]">
                Cryptographic Reasoning Trace
              </h3>
              <p className="mt-0.5 font-mono text-xs text-[#8c909f] break-all">
                Target: {activeReport.txHash}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                  activeReport.verdict === 'CRITICAL_THREAT'
                    ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40'
                    : activeReport.verdict === 'ELEVATED_RISK'
                      ? 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40'
                      : 'bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/40'
                }`}
              >
                {activeReport.verdict === 'CRITICAL_THREAT' ? (
                  <ShieldAlert className="h-3.5 w-3.5" />
                ) : activeReport.verdict === 'ELEVATED_RISK' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {activeReport.verdict}
              </span>

              <button
                type="button"
                onClick={handleSaveReport}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded border border-[#3b82f6]/50 bg-[#131b2e] px-3 py-1.5 text-xs font-medium text-[#dae2fd] transition-colors hover:border-[#3b82f6] whitespace-nowrap shrink-0"
              >
                <BookmarkCheck className="h-3.5 w-3.5 text-[#60a5fa]" />
                {isSaving ? 'Saving...' : 'Commit Report'}
              </button>
            </div>
          </div>

          {activeReport.apiNotice && (
            <div className="mt-4 rounded border border-[#222a3d] bg-[#0b1326] px-3.5 py-2.5 text-xs text-[#c2c6d6]">
              {activeReport.apiNotice}
            </div>
          )}

          {saveFeedback && (
            <div className="mt-3 rounded border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3.5 py-2 text-xs text-[#adc6ff]">
              {saveFeedback}
            </div>
          )}

          {/* Executive Synthesis */}
          <div className="mt-4 rounded border border-[#222a3d] bg-[#0b0f19] p-4">
            <div className="text-xs font-semibold text-[#8c909f]">
              Executive Forensic Synthesis
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#dae2fd]">
              {activeReport.summary}
            </p>
          </div>

          {/* Multi-Hop Reasoning Chain */}
          <div className="mt-5">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-[#c2c6d6]">
              <Layers className="h-3.5 w-3.5 text-[#60a5fa]" />
              Multi-Hop Reasoning Decomposition
            </h4>
            <div className="mt-2.5 space-y-2.5">
              {activeReport.reasoningSteps.map((step) => (
                <div
                  key={step.hopIndex}
                  className="rounded border border-[#222a3d] bg-[#0b0f19] p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#dae2fd]">
                      0{step.hopIndex}. {step.phase}
                    </span>
                    <span className="font-mono text-xs text-[#60a5fa] tabular-nums">
                      Confidence: {step.confidencePct}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#c2c6d6]">{step.finding}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Vector Meters */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-[#c2c6d6]">
              Threat Vector Telemetry Breakdown
            </h4>
            <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {activeReport.vectorBreakdown.map((vec) => (
                <div
                  key={vec.label}
                  className="rounded border border-[#222a3d] bg-[#0b0f19] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#dae2fd]">{vec.label}</span>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        vec.score >= 75
                          ? 'text-[#ef4444]'
                          : vec.score >= 40
                            ? 'text-[#f59e0b]'
                            : 'text-[#60a5fa]'
                      }`}
                    >
                      {vec.score}/100
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#171f33]">
                    <div
                      className={`h-full ${
                        vec.score >= 75
                          ? 'bg-[#ef4444]'
                          : vec.score >= 40
                            ? 'bg-[#f59e0b]'
                            : 'bg-[#3b82f6]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, vec.score))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-[#8c909f]">{vec.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Directives & Direct Action Execution */}
          <div className="mt-5 border-t border-[#222a3d] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-[#c2c6d6]">
                  Recommended Operational Directives
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-[#8c909f]">
                  {activeReport.recommendedActions.map((act, i) => (
                    <li key={i}>• {act}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyRecommendedStatus(selectedEntry, 'QUARANTINED')}
                  className="rounded border border-[#ef4444]/50 bg-[#ef4444]/10 px-3 py-1.5 text-xs font-medium text-[#ffb3ad] hover:bg-[#ef4444]/20 whitespace-nowrap shrink-0"
                >
                  Enforce Quarantine
                </button>
                <button
                  type="button"
                  onClick={() => onApplyRecommendedStatus(selectedEntry, 'SETTLED')}
                  className="rounded bg-[#3b82f6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#60a5fa] whitespace-nowrap shrink-0"
                >
                  Approve Settlement
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
