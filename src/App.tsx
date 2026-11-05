/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, type ReactNode } from 'react';
import {
  Search,
  Plus,
  Terminal,
  Cpu,
  LogIn,
  LogOut,
  Command,
  ArrowUpRight,
  Database,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Radio,
  Layers,
  Eye,
} from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import {
  INITIAL_SEED_LEDGER,
  GLASS_FINISH_SPECS,
  filterLedgerEntries,
  computeLedgerMetrics,
  buildDeterministicForensicReport,
  type LedgerEntryItem,
  type RiskLevel,
  type LedgerStatus,
  type ValidationResult,
  type ForensicAnalysisResult,
  type GlassFinishId,
  type CameraPresetId,
  type GlyphWordId,
} from './utils/ledgerLogic';
import { RecordEntryModal } from './components/RecordEntryModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { MfaOverrideModal } from './components/MfaOverrideModal';
import { ForensicLabView } from './components/ForensicLabView';
import { ThreatMatrixView } from './components/ThreatMatrixView';
import { GlassTypoScene3D } from './components/GlassTypoScene3D';
import { AiAssistantDock } from './components/AiAssistantDock';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class FirestoreErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] p-8 text-[#dae2fd]">
          <div className="mx-auto max-w-2xl rounded-lg border border-[#ef4444] bg-[#0f172a] p-6">
            <h1 className="text-lg font-semibold text-[#ef4444]">
              Security Perimeter Exception Detected
            </h1>
            <p className="mt-2 text-xs text-[#c2c6d6]">
              A Firestore security rule or runtime invariant blocked the requested operation:
            </p>
            <pre className="mt-3 overflow-x-auto rounded border border-[#222a3d] bg-[#0b0f19] p-3 font-mono text-xs text-[#ffb3ad]">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="mt-4 rounded bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white"
            >
              Acknowledge &amp; Resume Console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'glass3d' | 'ledger' | 'threats' | 'forensics' | 'rules'
  >('glass3d');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authBanner, setAuthBanner] = useState('');

  // 3D Glass Typography Studio State
  const [glyphWord, setGlyphWord] = useState<GlyphWordId>('APEX');
  const [glassFinish, setGlassFinish] = useState<GlassFinishId>('sapphire');
  const [explodedAmount, setExplodedAmount] = useState<number>(18);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('orbit');
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [selected3DNodeNotice, setSelected3DNodeNotice] = useState<string>(
    "3D Optical Glass Typography 'APEX' · IOR 1.76 · 36 Orbital Shards"
  );

  // Multi-Turn Gemini Chatbot & Live Voice Console state
  const [aiConsoleState, setAiConsoleState] = useState<{
    isOpen: boolean;
    mode: 'chat' | 'voice';
  }>({ isOpen: false, mode: 'chat' });

  // Ledger state: combines deterministic seed entries with real-time user Firestore entries
  const [localEntries, setLocalEntries] = useState<LedgerEntryItem[]>(INITIAL_SEED_LEDGER);
  const [firestoreEntries, setFirestoreEntries] = useState<LedgerEntryItem[]>([]);
  const [savedReports, setSavedReports] = useState<ForensicAnalysisResult[]>([]);

  // Filtering & Selection
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LedgerStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string>(INITIAL_SEED_LEDGER[0].id);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [mfaModalState, setMfaModalState] = useState<{
    isOpen: boolean;
    entry: LedgerEntryItem | null;
    targetStatus: LedgerStatus;
  }>({ isOpen: false, entry: null, targetStatus: 'OVERRIDDEN' });

  // Inline Deep Thinking Forensic state in main inspector
  const [inlineForensicReport, setInlineForensicReport] = useState<ForensicAnalysisResult | null>(
    null
  );
  const [isRunningInlineForensics, setIsRunningInlineForensics] = useState(false);

  // Terminal audit stream
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log_1',
      timestamp: '21:54:12Z',
      level: 'CRITICAL',
      message:
        'BLOCK #21490849: Auto-quarantined 0x9f4a8c2e... ($18,450,000 ETH) — Flash-Loan Reentrancy signature.',
    },
    {
      id: 'log_2',
      timestamp: '21:50:05Z',
      level: 'INFO',
      message:
        'BLOCK #21490847: Finalized custody settlement 0x3b8e1d7c... ($6,200,000 USDC) to Citadel Prime Custody.',
    },
    {
      id: 'log_3',
      timestamp: '21:42:18Z',
      level: 'WARN',
      message:
        'BLOCK #21490844: Flagged 0x7c2d9f1a... ($3,890,000 BTC) for PENDING_AUDIT due to L2 slippage anomaly.',
    },
  ]);

  const appendAuditLog = (level: AuditLogEntry['level'], message: string) => {
    const now = new Date().toISOString().slice(11, 19) + 'Z';
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        level,
        message,
      },
      ...prev.slice(0, 29),
    ]);
  };

  // Keyboard shortcuts: Cmd/Ctrl + K for Command Palette, H for HUD Collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen((prev) => !prev);
      } else if (!isInput && e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) {
        setIsHudCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              displayName: (currentUser.displayName || 'Apex Analyst').slice(0, 80),
              clearanceTier: 'L1_ANALYST',
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Profile may already exist with immutable createdAt
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!isAuthReady || !user) {
      setFirestoreEntries([]);
      return;
    }

    const ledgerQuery = query(
      collection(db, 'ledger_entries'),
      where('ownerId', '==', user.uid)
    );
    const unsubLedger = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        const items: LedgerEntryItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || user.uid),
            txHash: String(data.txHash || ''),
            blockHeight: Number(data.blockHeight || 21490850),
            sourceEntity: String(data.sourceEntity || ''),
            destinationEntity: String(data.destinationEntity || ''),
            amountUsd: Number(data.amountUsd || 0),
            assetSymbol: (data.assetSymbol || 'USDC') as LedgerEntryItem['assetSymbol'],
            riskLevel: (data.riskLevel || 'NOMINAL') as RiskLevel,
            riskScore: Number(data.riskScore || 10),
            status: (data.status || 'PENDING_AUDIT') as LedgerStatus,
            threatVector: String(data.threatVector || ''),
            createdAtIso: new Date().toISOString(),
            updatedAtIso: new Date().toISOString(),
            persistedInFirestore: true,
          };
        });
        setFirestoreEntries(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'ledger_entries');
      }
    );

    const reportsQuery = query(
      collection(db, 'forensic_reports'),
      where('ownerId', '==', user.uid)
    );
    const unsubReports = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const reps: ForensicAnalysisResult[] = snapshot.docs.map((d) => {
          const data = d.data();
          return buildDeterministicForensicReport({
            txHash: String(data.txHash || '0x0000000000'),
            queryPrompt: String(data.queryPrompt || 'Forensic Audit'),
          });
        });
        setSavedReports(reps);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'forensic_reports');
      }
    );

    return () => {
      unsubLedger();
      unsubReports();
    };
  }, [isAuthReady, user]);

  // Combined ledger entries
  const allEntries = useMemo(() => {
    const map = new Map<string, LedgerEntryItem>();
    for (const item of firestoreEntries) {
      map.set(item.id, item);
    }
    for (const item of localEntries) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.blockHeight - a.blockHeight);
  }, [firestoreEntries, localEntries]);

  const filteredEntries = useMemo(
    () =>
      filterLedgerEntries(allEntries, {
        riskFilter,
        statusFilter,
        searchQuery,
      }),
    [allEntries, riskFilter, statusFilter, searchQuery]
  );

  const metrics = useMemo(() => computeLedgerMetrics(allEntries), [allEntries]);

  const selectedEntry = useMemo(
    () =>
      allEntries.find((e) => e.id === selectedEntryId) || allEntries[0] || INITIAL_SEED_LEDGER[0],
    [allEntries, selectedEntryId]
  );

  const highestBlockHeight = useMemo(
    () => allEntries.reduce((max, item) => Math.max(max, item.blockHeight), 21490850),
    [allEntries]
  );

  const handleGoogleSignIn = async () => {
    setAuthBanner('');
    try {
      await signInWithPopup(auth, googleProvider);
      appendAuditLog('INFO', 'Authenticated security analyst session via Google OAuth.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthBanner(
        `Google Sign-In popup status: ${msg}. Operating with local cryptographic state + Firestore sync ready.`
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    appendAuditLog('INFO', 'Closed authenticated analyst session.');
  };

  const handleCreateLedgerEntry = async (
    sanitized: NonNullable<ValidationResult['sanitized']>
  ) => {
    const entryId = `tx_${Date.now()}`;
    const newItem: LedgerEntryItem = {
      id: entryId,
      ownerId: user?.uid || 'local_analyst',
      txHash: sanitized.txHash,
      blockHeight: sanitized.blockHeight,
      sourceEntity: sanitized.sourceEntity,
      destinationEntity: sanitized.destinationEntity,
      amountUsd: sanitized.amountUsd,
      assetSymbol: sanitized.assetSymbol,
      riskLevel: sanitized.riskLevel,
      riskScore: sanitized.riskScore,
      status: sanitized.status,
      threatVector: sanitized.threatVector,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
      persistedInFirestore: Boolean(user),
    };

    setLocalEntries((prev) => [newItem, ...prev]);
    setSelectedEntryId(entryId);
    if (sanitized.riskLevel === 'CRITICAL') {
      setGlassFinish('ruby');
    }
    appendAuditLog(
      sanitized.riskLevel === 'CRITICAL'
        ? 'CRITICAL'
        : sanitized.riskLevel === 'WARNING'
          ? 'WARN'
          : 'INFO',
      `BLOCK #${sanitized.blockHeight}: Recorded ${sanitized.txHash.slice(0, 14)}... ($${sanitized.amountUsd.toLocaleString('en-US')} ${sanitized.assetSymbol}) — Risk ${sanitized.riskScore}/100 (${sanitized.status}).`
    );

    if (user) {
      try {
        await setDoc(doc(db, 'ledger_entries', entryId), {
          ownerId: user.uid,
          txHash: sanitized.txHash,
          blockHeight: sanitized.blockHeight,
          sourceEntity: sanitized.sourceEntity,
          destinationEntity: sanitized.destinationEntity,
          amountUsd: sanitized.amountUsd,
          assetSymbol: sanitized.assetSymbol,
          riskLevel: sanitized.riskLevel,
          riskScore: sanitized.riskScore,
          status: sanitized.status,
          threatVector: sanitized.threatVector,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `ledger_entries/${entryId}`);
      }
    }
  };

  const executeStatusTransition = async (
    entry: LedgerEntryItem,
    newStatus: LedgerStatus,
    reasonNote?: string
  ) => {
    if (entry.status === 'SETTLED') {
      appendAuditLog(
        'WARN',
        `Terminal state lock prevented modifying finalized settlement ${entry.txHash.slice(0, 14)}...`
      );
      return;
    }

    setLocalEntries((prev) =>
      prev.map((item) =>
        item.id === entry.id
          ? { ...item, status: newStatus, updatedAtIso: new Date().toISOString() }
          : item
      )
    );

    appendAuditLog(
      newStatus === 'QUARANTINED' ? 'CRITICAL' : 'INFO',
      `State transition on ${entry.txHash.slice(0, 14)}...: ${entry.status} -> ${newStatus}${
        reasonNote ? ` (${reasonNote})` : ''
      }`
    );

    if (user && entry.persistedInFirestore) {
      try {
        await updateDoc(doc(db, 'ledger_entries', entry.id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `ledger_entries/${entry.id}`);
      }
    }
  };

  const handleRunInlineForensics = async (target: LedgerEntryItem) => {
    setIsRunningInlineForensics(true);
    try {
      const response = await fetch('/api/forensics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: target.txHash,
          queryPrompt: `Perform deep high-thinking cryptographic risk audit on ${target.sourceEntity} -> ${target.destinationEntity} (${target.assetSymbol}).`,
          entry: target,
        }),
      });
      const report = (await response.json()) as ForensicAnalysisResult;
      setInlineForensicReport(report);
      appendAuditLog(
        'INFO',
        `Completed gemini-4-argon (ThinkingLevel.HIGH) trace on ${target.txHash.slice(0, 14)}... -> Verdict: ${report.verdict}`
      );
    } catch {
      const fallback = buildDeterministicForensicReport({
        txHash: target.txHash,
        queryPrompt: 'Deep cryptographic trace',
        entry: target,
      });
      setInlineForensicReport(fallback);
    } finally {
      setIsRunningInlineForensics(false);
    }
  };

  const handleSaveForensicReport = async (report: ForensicAnalysisResult) => {
    setSavedReports((prev) => [report, ...prev]);
    appendAuditLog('INFO', `Committed forensic report for ${report.txHash.slice(0, 14)}...`);

    if (user) {
      const reportId = `rep_${Date.now()}`;
      try {
        await setDoc(doc(db, 'forensic_reports', reportId), {
          ownerId: user.uid,
          txHash: report.txHash,
          queryPrompt: report.queryPrompt.slice(0, 500),
          verdict: report.verdict,
          summary: report.summary.slice(0, 2000),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `forensic_reports/${reportId}`);
      }
    }
  };

  const handleQuarantineAllCritical = async () => {
    setLocalEntries((prev) =>
      prev.map((item) =>
        item.riskLevel === 'CRITICAL' && item.status !== 'SETTLED'
          ? { ...item, status: 'QUARANTINED' }
          : item
      )
    );
    setGlassFinish('ruby');
    appendAuditLog(
      'CRITICAL',
      'Executed batch directive: All CRITICAL risk vectors locked in QUARANTINED state.'
    );
  };

  return (
    <FirestoreErrorBoundary>
      <div className="relative min-h-screen w-full bg-[#060b16] text-[#dae2fd] flex flex-col">
        {/* Persistent Full-Bleed Three.js 3D Glass Typography & Cryptographic Vault Canvas */}
        <GlassTypoScene3D
          glyphWord={glyphWord}
          glassFinish={glassFinish}
          explodedAmount={explodedAmount}
          cameraPreset={cameraPreset}
          entries={allEntries}
          onSelectGlyphOrShard={(info) => {
            setSelected3DNodeNotice(info);
            appendAuditLog('INFO', `Inspected 3D optical node: ${info}`);
          }}
        />

        {/* Strict 3-Zone Top Bar Contract (Solid surface — zero backdrop-filter over WebGL) */}
        <header className="relative z-20 flex items-center justify-between gap-8 border-b border-[#222a3d] bg-[#0b1326] px-4 py-3 sm:px-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('glass3d');
            }}
            className="font-display text-lg font-bold tracking-tight text-[#dae2fd] whitespace-nowrap shrink-0"
          >
            Apex Security &amp; Ledger
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#c2c6d6]"
          >
            <button
              type="button"
              onClick={() => setActiveTab('glass3d')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'glass3d'
                  ? 'text-[#dae2fd] underline decoration-[#3b82f6] decoration-2 underline-offset-8'
                  : 'hover:text-[#dae2fd]'
              }`}
            >
              3D Glass Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ledger'
                  ? 'text-[#dae2fd] underline decoration-[#3b82f6] decoration-2 underline-offset-8'
                  : 'hover:text-[#dae2fd]'
              }`}
            >
              Settlement Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('threats')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'threats'
                  ? 'text-[#dae2fd] underline decoration-[#3b82f6] decoration-2 underline-offset-8'
                  : 'hover:text-[#dae2fd]'
              }`}
            >
              Threat Matrix
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('forensics')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'forensics'
                  ? 'text-[#dae2fd] underline decoration-[#3b82f6] decoration-2 underline-offset-8'
                  : 'hover:text-[#dae2fd]'
              }`}
            >
              Forensic AI Lab
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rules'
                  ? 'text-[#dae2fd] underline decoration-[#3b82f6] decoration-2 underline-offset-8'
                  : 'hover:text-[#dae2fd]'
              }`}
            >
              Security Rules
            </button>
          </nav>

          {/* Zone 3: 1 primary action button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#60a5fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60a5fa] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Record Ledger Entry
            </button>
          </div>
        </header>

        {/* When in 3D Glass Studio mode: keep center 100% unobstructed! Only show minimal top-left spec strip */}
        {activeTab === 'glass3d' && (
          <div className="pointer-events-none relative z-10 flex-1 flex flex-col justify-between p-4 sm:p-6">
            <div className="pointer-events-auto inline-flex max-w-xl flex-wrap items-center gap-2 rounded border border-[#222a3d] bg-[#0b1326] px-3.5 py-2 text-xs">
              <span className="font-semibold text-[#dae2fd]">{selected3DNodeNotice}</span>
              <span aria-hidden="true" className="text-[#8c909f]">
                ·
              </span>
              <span className="font-mono text-[#60a5fa] tabular-nums">
                Volume: ${metrics.totalVolumeUsd.toLocaleString('en-US')}
              </span>
              <span aria-hidden="true" className="text-[#8c909f]">
                ·
              </span>
              <span className="font-mono text-[#ef4444] tabular-nums">
                Critical: {metrics.criticalCount}
              </span>
            </div>
          </div>
        )}

        {/* When in Data Workspace views (Ledger, Threats, Forensics, Rules): render structured 12-column overlay */}
        {activeTab !== 'glass3d' && (
          <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-8 space-y-6 bg-[#0b0f19]/95">
            {authBanner && (
              <div className="flex items-center justify-between rounded border border-[#f59e0b]/40 bg-[#131b2e] px-4 py-2.5 text-xs text-[#ffddb8]">
                <span>{authBanner}</span>
                <button
                  type="button"
                  onClick={() => setAuthBanner('')}
                  className="text-xs underline ml-4 whitespace-nowrap shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* 4-Column Institutional Telemetry KPI Strip */}
            <section
              aria-label="Key Ledger Telemetry Metrics"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between text-xs text-[#8c909f]">
                  <span>Monitored Settlement Volume</span>
                  <span className="font-mono text-[#60a5fa]">{allEntries.length} Blocks</span>
                </div>
                <div
                  data-testid="kpi-total-volume"
                  className="mt-2 font-mono text-2xl font-bold text-[#dae2fd] tabular-nums"
                >
                  ${metrics.totalVolumeUsd.toLocaleString('en-US')}
                </div>
                <div className="mt-1 text-xs text-[#8c909f]">
                  <span>Settled: {metrics.settledCount}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Pending Audit: {metrics.pendingAuditCount}</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between text-xs text-[#8c909f]">
                  <span>Critical Threat Vectors</span>
                  <span className="font-mono text-[#ef4444]">Auto-Guard Active</span>
                </div>
                <div
                  data-testid="kpi-critical-count"
                  className="mt-2 font-mono text-2xl font-bold text-[#ef4444] tabular-nums"
                >
                  {metrics.criticalCount} Active
                </div>
                <div className="mt-1 font-mono text-xs text-[#8c909f] tabular-nums">
                  Quarantined Value: ${metrics.quarantinedVolumeUsd.toLocaleString('en-US')}
                </div>
              </div>

              <div className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between text-xs text-[#8c909f]">
                  <span>Pending L2 Multi-Sig Audit</span>
                  <span className="font-mono text-[#f59e0b]">Cautionary Queue</span>
                </div>
                <div
                  data-testid="kpi-pending-count"
                  className="mt-2 font-mono text-2xl font-bold text-[#f59e0b] tabular-nums"
                >
                  {metrics.pendingAuditCount} Entries
                </div>
                <div className="mt-1 text-xs text-[#8c909f]">
                  <span>Warning Vectors: {metrics.warningCount}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Mean Risk: {metrics.meanRiskScore}/100</span>
                </div>
              </div>

              <div className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-4">
                <div className="flex items-center justify-between text-xs text-[#8c909f]">
                  <span>Forensic AI Reasoning Engine</span>
                  <span className="font-mono text-[#60a5fa]">ThinkingLevel.HIGH</span>
                </div>
                <div className="mt-2 font-mono text-xl font-bold text-[#dae2fd] tabular-nums">
                  gemini-4-argon
                </div>
                <div className="mt-1 text-xs text-[#8c909f]">
                  <span>Firestore DB: </span>
                  <span className="font-mono text-[#c2c6d6]">
                    {user ? 'Synced (Live)' : 'Ready (Local Seed)'}
                  </span>
                </div>
              </div>
            </section>

            {/* View 1: Settlement Ledger & Side-by-Side Forensic Inspector */}
            {activeTab === 'ledger' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#222a3d] bg-[#0f172a] p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['ALL', 'CRITICAL', 'WARNING', 'NOMINAL'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setRiskFilter(lvl)}
                          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            riskFilter === lvl
                              ? lvl === 'CRITICAL'
                                ? 'bg-[#ef4444] text-white'
                                : lvl === 'WARNING'
                                  ? 'bg-[#f59e0b] text-[#0b0f19] font-semibold'
                                  : 'bg-[#3b82f6] text-white'
                              : 'bg-[#0b0f19] text-[#c2c6d6] hover:bg-[#171f33]'
                          }`}
                        >
                          {lvl === 'ALL' ? `All Risks (${allEntries.length})` : lvl}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-2 min-w-[220px]">
                      <div className="relative w-full max-w-xs">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8c909f]" />
                        <input
                          type="text"
                          aria-label="Filter ledger by hash, entity, or asset"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search hash (0x...), vault, asset..."
                          className="w-full rounded border border-[#222a3d] bg-[#0b0f19] pl-8 pr-3 py-1.5 text-xs text-[#dae2fd] placeholder-[#8c909f] focus:border-[#3b82f6] focus:outline-none"
                        />
                      </div>
                      <select
                        aria-label="Filter by settlement status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'ALL' | LedgerStatus)}
                        className="rounded border border-[#222a3d] bg-[#0b0f19] px-2.5 py-1.5 text-xs text-[#c2c6d6] focus:border-[#3b82f6] focus:outline-none"
                      >
                        <option value="ALL">All States</option>
                        <option value="QUARANTINED">QUARANTINED</option>
                        <option value="PENDING_AUDIT">PENDING_AUDIT</option>
                        <option value="SETTLED">SETTLED</option>
                        <option value="OVERRIDDEN">OVERRIDDEN</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-[#222a3d] bg-[#0f172a]">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-[#222a3d] bg-[#0b1326] text-[11px] font-semibold text-[#8c909f]">
                            <th className="py-3 pl-4 pr-2">Tx Hash &amp; Block</th>
                            <th className="px-3 py-3">Settlement Corridor</th>
                            <th className="px-3 py-3 text-right">Amount (USD)</th>
                            <th className="px-3 py-3">Risk Metric</th>
                            <th className="py-3 pl-2 pr-4 text-right">Ledger State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222a3d] text-xs">
                          {filteredEntries.map((item) => {
                            const isSelected = item.id === selectedEntry.id;
                            return (
                              <tr
                                key={item.id}
                                onClick={() => {
                                  setSelectedEntryId(item.id);
                                  setInlineForensicReport(null);
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-[#171f33]' : 'hover:bg-[#131b2e]'
                                }`}
                              >
                                <td className="py-3 pl-4 pr-2 align-top">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEntryId(item.id);
                                      setInlineForensicReport(null);
                                    }}
                                    className="font-mono text-xs font-medium text-[#60a5fa] hover:underline text-left"
                                  >
                                    {item.txHash.slice(0, 14)}...{item.txHash.slice(-4)}
                                  </button>
                                  <div className="mt-0.5 font-mono text-[11px] text-[#8c909f] tabular-nums">
                                    #{item.blockHeight}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="font-medium text-[#dae2fd]">
                                    {item.sourceEntity} → {item.destinationEntity}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-[#8c909f]">
                                    {item.threatVector}
                                  </div>
                                </td>

                                <td className="px-3 py-3 text-right align-top font-mono tabular-nums">
                                  <div className="font-semibold text-[#dae2fd]">
                                    ${item.amountUsd.toLocaleString('en-US')}
                                  </div>
                                  <div className="text-[11px] text-[#8c909f]">
                                    {item.assetSymbol}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                                      item.riskLevel === 'CRITICAL'
                                        ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40'
                                        : item.riskLevel === 'WARNING'
                                          ? 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40'
                                          : 'bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/40'
                                    }`}
                                  >
                                    {item.riskLevel} · {item.riskScore}
                                  </span>
                                </td>

                                <td className="py-3 pl-2 pr-4 text-right align-top font-mono text-[11px] whitespace-nowrap">
                                  <span
                                    className={
                                      item.status === 'QUARANTINED'
                                        ? 'text-[#ef4444] font-semibold'
                                        : item.status === 'PENDING_AUDIT'
                                          ? 'text-[#f59e0b]'
                                          : item.status === 'OVERRIDDEN'
                                            ? 'text-[#60a5fa]'
                                            : 'text-[#c2c6d6]'
                                    }
                                  >
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}

                          {filteredEntries.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center">
                                <p className="text-sm font-medium text-[#dae2fd]">
                                  No settlement blocks match the active filter criteria
                                </p>
                                <p className="mt-1 text-xs text-[#8c909f]">
                                  Clear your search query or reset risk filters to inspect all
                                  monitored transactions.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRiskFilter('ALL');
                                    setStatusFilter('ALL');
                                    setSearchQuery('');
                                  }}
                                  className="mt-3 rounded border border-[#3b82f6] bg-[#131b2e] px-3.5 py-1.5 text-xs font-medium text-[#dae2fd] hover:bg-[#3b82f6] hover:text-white"
                                >
                                  Reset Active Filters
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right 4 Columns: Active Block Forensic Inspector */}
                <aside
                  aria-label="Selected Transaction Forensic Inspector"
                  className="space-y-4 lg:col-span-4"
                >
                  <div className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5">
                    <div className="flex items-start justify-between border-b border-[#222a3d] pb-3.5">
                      <div>
                        <span className="text-xs text-[#8c909f]">Active Block Telemetry</span>
                        <h2 className="mt-0.5 text-base font-semibold text-[#dae2fd]">
                          {selectedEntry.sourceEntity}
                        </h2>
                        <p className="text-xs text-[#60a5fa]">
                          → {selectedEntry.destinationEntity}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                          selectedEntry.riskLevel === 'CRITICAL'
                            ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/40'
                            : selectedEntry.riskLevel === 'WARNING'
                              ? 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40'
                              : 'bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/40'
                        }`}
                      >
                        Risk {selectedEntry.riskScore}/100
                      </span>
                    </div>

                    <dl className="mt-2 divide-y divide-[#222a3d] text-xs">
                      <div className="py-2.5">
                        <dt className="text-[11px] text-[#8c909f]">Cryptographic Hash</dt>
                        <dd className="mt-0.5 font-mono text-xs text-[#dae2fd] break-all select-all">
                          {selectedEntry.txHash}
                        </dd>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2.5">
                        <div>
                          <dt className="text-[11px] text-[#8c909f]">Block Height</dt>
                          <dd className="mt-0.5 font-mono text-xs font-semibold text-[#dae2fd] tabular-nums">
                            #{selectedEntry.blockHeight}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-[11px] text-[#8c909f]">Settlement Value</dt>
                          <dd className="mt-0.5 font-mono text-xs font-semibold text-[#dae2fd] tabular-nums">
                            ${selectedEntry.amountUsd.toLocaleString('en-US')}{' '}
                            {selectedEntry.assetSymbol}
                          </dd>
                        </div>
                      </div>

                      <div className="py-2.5">
                        <dt className="text-[11px] text-[#8c909f]">Detected Threat Signature</dt>
                        <dd className="mt-0.5 text-xs text-[#c2c6d6]">
                          {selectedEntry.threatVector}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-[11px] text-[#8c909f]">Current Ledger State</dt>
                        <dd className="font-mono text-xs font-semibold text-[#dae2fd]">
                          {selectedEntry.status}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 space-y-2 border-t border-[#222a3d] pt-3.5">
                      <div className="text-xs font-semibold text-[#c2c6d6]">
                        Operational State Controls
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={selectedEntry.status === 'SETTLED'}
                          onClick={() => executeStatusTransition(selectedEntry, 'QUARANTINED')}
                          className="rounded border border-[#ef4444]/50 bg-[#ef4444]/10 px-3 py-2 text-xs font-semibold text-[#ffb3ad] transition-colors hover:bg-[#ef4444] hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                        >
                          Quarantine Hash
                        </button>
                        <button
                          type="button"
                          disabled={selectedEntry.status === 'SETTLED'}
                          onClick={() => executeStatusTransition(selectedEntry, 'SETTLED')}
                          className="rounded bg-[#3b82f6] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#60a5fa] disabled:opacity-40 whitespace-nowrap shrink-0"
                        >
                          Approve Settlement
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={selectedEntry.status === 'SETTLED'}
                        onClick={() =>
                          setMfaModalState({
                            isOpen: true,
                            entry: selectedEntry,
                            targetStatus: 'OVERRIDDEN',
                          })
                        }
                        className="w-full rounded border border-[#222a3d] bg-[#131b2e] px-3 py-2 text-xs font-medium text-[#c2c6d6] transition-colors hover:border-[#f59e0b] hover:text-[#dae2fd] disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        Hardware MFA Override...
                      </button>
                    </div>

                    <div className="mt-3.5 border-t border-[#222a3d] pt-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#dae2fd]">
                          High-Thinking AI Audit
                        </span>
                        <span className="font-mono text-[11px] text-[#60a5fa]">
                          gemini-4-argon · HIGH
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRunInlineForensics(selectedEntry)}
                          disabled={isRunningInlineForensics}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/15 px-3 py-2 text-xs font-semibold text-[#dae2fd] transition-colors hover:bg-[#3b82f6] hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <Cpu className="h-3.5 w-3.5" />
                          {isRunningInlineForensics
                            ? 'Synthesizing Trace...'
                            : 'Run Deep Forensic Trace'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('forensics')}
                          aria-label="Expand in Forensic Workspace"
                          className="rounded border border-[#222a3d] bg-[#0b0f19] p-2 text-[#c2c6d6] hover:border-[#3b82f6] hover:text-[#dae2fd]"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </div>

                      {inlineForensicReport && (
                        <div className="mt-3 rounded border border-[#3b82f6]/40 bg-[#0b0f19] p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-[#60a5fa]">
                              {inlineForensicReport.verdict}
                            </span>
                            <span className="font-mono text-[11px] text-[#8c909f]">
                              {inlineForensicReport.modelUsed} ({inlineForensicReport.thinkingLevel})
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-[#c2c6d6]">
                            {inlineForensicReport.summary}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('forensics')}
                            className="text-xs font-medium text-[#60a5fa] hover:underline"
                          >
                            Inspect full 3-hop reasoning decomposition →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {activeTab === 'threats' && (
              <ThreatMatrixView
                entries={allEntries}
                onQuarantineAllCritical={handleQuarantineAllCritical}
                onSelectEntryForForensics={(item) => {
                  setSelectedEntryId(item.id);
                  setActiveTab('forensics');
                }}
              />
            )}

            {activeTab === 'forensics' && (
              <ForensicLabView
                entries={allEntries}
                selectedEntry={selectedEntry}
                onSelectEntry={(item) => setSelectedEntryId(item.id)}
                savedReports={savedReports}
                onSaveReportToFirestore={handleSaveForensicReport}
                onApplyRecommendedStatus={(item, st) => executeStatusTransition(item, st)}
              />
            )}

            {activeTab === 'rules' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5 lg:col-span-6">
                  <h2 className="text-base font-semibold text-[#dae2fd]">
                    Hardened Zero-Trust Firestore Security Rules
                  </h2>
                  <p className="mt-0.5 text-xs text-[#8c909f]">
                    Enforces Default-Deny, Verified Email Identity, Strict Schema Keys, and Terminal
                    State Locking (<code className="font-mono">SETTLED</code> immutability).
                  </p>
                  <pre className="mt-4 max-h-96 overflow-auto rounded border border-[#222a3d] bg-[#0b0f19] p-4 font-mono text-xs text-[#c2c6d6]">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isVerifiedUser() {
      return request.auth != null &&
             request.auth.token.email_verified == true;
    }
    // Strict ownership & terminal state locking active
  }
}`}
                  </pre>
                </section>

                <section className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-5 lg:col-span-6">
                  <h2 className="text-base font-semibold text-[#dae2fd]">
                    Eight Pillars Compliance &amp; Red Team Status
                  </h2>
                  <p className="mt-0.5 text-xs text-[#8c909f]">
                    Synchronized with <code className="font-mono">firebase-blueprint.json</code>
                  </p>
                  <div className="mt-4 space-y-2.5 text-xs">
                    {[
                      [
                        '01. Global Default-Deny Safety Net',
                        'Active on /{document=**} prior to collection match blocks.',
                      ],
                      [
                        '02. Anti-Update-Gap Blueprint Helpers',
                        'isValidLedgerEntry(incoming()) wraps both create and update operations.',
                      ],
                      [
                        '03. Path Variable & String Size Bounds',
                        'isValidId(entryId) + strict maxLength on all string fields.',
                      ],
                      [
                        '04. Terminal State Immutability Gate',
                        'existing().status != "SETTLED" blocks post-settlement tampering.',
                      ],
                    ].map(([title, desc]) => (
                      <div
                        key={title}
                        className="rounded border border-[#222a3d] bg-[#0b0f19] p-3"
                      >
                        <div className="font-semibold text-[#dae2fd]">{title}</div>
                        <div className="mt-0.5 text-[#8c909f]">{desc}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* Terminal-Style Cryptographic Telemetry Stream */}
            <section
              aria-label="Cryptographic Audit Log Stream"
              className="rounded-lg border border-[#222a3d] bg-[#0f172a] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222a3d] pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#60a5fa]" />
                  <h2 className="text-xs font-semibold text-[#dae2fd]">
                    Cryptographic Audit Log Stream
                  </h2>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoScrollLogs}
                  onClick={() => setAutoScrollLogs((prev) => !prev)}
                  className="rounded border border-[#222a3d] bg-[#0b0f19] px-2.5 py-1 font-mono text-[11px] text-[#c2c6d6] hover:border-[#3b82f6]"
                >
                  Auto-Scroll: {autoScrollLogs ? 'ON' : 'PAUSED'}
                </button>
              </div>

              <div className="mt-2.5 max-h-32 overflow-y-auto rounded border border-[#222a3d] bg-[#060e20] p-3 font-mono text-xs space-y-1.5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-[#8c909f] shrink-0 tabular-nums">[{log.timestamp}]</span>
                    <span
                      className={`shrink-0 font-semibold ${
                        log.level === 'CRITICAL'
                          ? 'text-[#ef4444]'
                          : log.level === 'WARN'
                            ? 'text-[#f59e0b]'
                            : 'text-[#60a5fa]'
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-[#c2c6d6]">{log.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}

        {/* Multi-Turn Gemini Chatbot & Live Voice Console Drawer */}
        <AiAssistantDock
          isOpen={aiConsoleState.isOpen}
          initialMode={aiConsoleState.mode}
          onClose={() => setAiConsoleState((prev) => ({ ...prev, isOpen: false }))}
          selectedEntry={selectedEntry}
        />

        {/* Unified Collapsible Bottom Control Dock (Zero backdrop-filter over WebGL, <= 15% viewport height) */}
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(940px,95vw)] -translate-x-1/2">
          <div className="flex justify-center mb-1 pointer-events-none">
            <button
              type="button"
              onClick={() => setIsHudCollapsed((prev) => !prev)}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-t border border-b-0 border-[#222a3d] bg-[#0b1326] px-3 py-1 text-[11px] font-medium text-[#c2c6d6] hover:text-[#dae2fd] whitespace-nowrap shrink-0"
            >
              {isHudCollapsed ? (
                <>
                  <ChevronUp className="h-3 w-3 text-[#60a5fa]" />
                  Show 3D Glass &amp; AI Controls (H)
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 text-[#60a5fa]" />
                  Hide Controls (H)
                </>
              )}
            </button>
          </div>

          {!isHudCollapsed && (
            <div
              role="region"
              aria-label="3D Glass Typography and AI Assistant Dock"
              className="rounded-lg border border-[#222a3d] bg-[#0b1326] px-4 py-2.5 shadow-2xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* 3D Typography Word Switcher */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#8c909f]">3D Type:</span>
                  {(['APEX', 'VAULT', 'ZERO'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setGlyphWord(w);
                        setSelected3DNodeNotice(
                          `3D Optical Glass Typography '${w}' · IOR ${GLASS_FINISH_SPECS[glassFinish].ior} · 36 Orbital Shards`
                        );
                        setActiveTab('glass3d');
                      }}
                      className={`rounded px-2 py-1 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        glyphWord === w
                          ? 'bg-[#3b82f6] text-white'
                          : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd]'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>

                {/* Optical Glass Material Finishes */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#8c909f]">Glass:</span>
                  {(Object.keys(GLASS_FINISH_SPECS) as GlassFinishId[]).map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => {
                        setGlassFinish(fid);
                        setSelected3DNodeNotice(
                          `3D Optical Glass Typography '${glyphWord}' · IOR ${GLASS_FINISH_SPECS[fid].ior} · 36 Orbital Shards`
                        );
                        setActiveTab('glass3d');
                      }}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        glassFinish === fid
                          ? 'bg-[#3b82f6] text-white'
                          : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd]'
                      }`}
                    >
                      {GLASS_FINISH_SPECS[fid].label}
                    </button>
                  ))}
                </div>

                {/* Exploded View Slider */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="exploded-slider"
                    className="flex items-center gap-1 text-[11px] font-medium text-[#8c909f] whitespace-nowrap shrink-0"
                  >
                    <Layers className="h-3 w-3 text-[#60a5fa]" />
                    Explode:
                  </label>
                  <input
                    id="exploded-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={explodedAmount}
                    onChange={(e) => setExplodedAmount(Number(e.target.value))}
                    className="h-1.5 w-20 cursor-pointer accent-[#3b82f6]"
                  />
                  <span className="font-mono text-[11px] text-[#dae2fd] tabular-nums w-8">
                    {explodedAmount}%
                  </span>
                </div>

                {/* Camera Presets */}
                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-[#60a5fa] mr-0.5" />
                  {(['orbit', 'macro', 'top', 'isometric'] as const).map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => {
                        setCameraPreset(cam);
                        setActiveTab('glass3d');
                      }}
                      className={`rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                        cameraPreset === cam
                          ? 'bg-[#222a3d] text-[#60a5fa] border border-[#3b82f6]/50'
                          : 'text-[#8c909f] hover:text-[#dae2fd]'
                      }`}
                    >
                      {cam}
                    </button>
                  ))}
                </div>

                {/* AI Chatbot, Live Voice & Auth Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setAiConsoleState((prev) => ({
                        isOpen: prev.mode === 'chat' ? !prev.isOpen : true,
                        mode: 'chat',
                      }))
                    }
                    className="inline-flex items-center gap-1.5 rounded border border-[#3b82f6]/50 bg-[#131b2e] px-2.5 py-1 text-xs font-semibold text-[#dae2fd] hover:bg-[#3b82f6] hover:text-white whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[#60a5fa]" />
                    AI Chat
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setAiConsoleState((prev) => ({
                        isOpen: prev.mode === 'voice' ? !prev.isOpen : true,
                        mode: 'voice',
                      }))
                    }
                    className="inline-flex items-center gap-1.5 rounded border border-[#3b82f6]/50 bg-[#131b2e] px-2.5 py-1 text-xs font-semibold text-[#dae2fd] hover:bg-[#3b82f6] hover:text-white whitespace-nowrap shrink-0"
                  >
                    <Radio className="h-3.5 w-3.5 text-[#60a5fa]" />
                    Live Voice
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCmdPaletteOpen(true)}
                    aria-label="Open Command Palette"
                    className="rounded border border-[#222a3d] bg-[#060e20] px-2 py-1 font-mono text-xs text-[#c2c6d6] hover:border-[#3b82f6] whitespace-nowrap shrink-0"
                  >
                    ⌘K
                  </button>

                  {user ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1 rounded border border-[#222a3d] bg-[#060e20] px-2.5 py-1 text-xs text-[#c2c6d6] hover:border-[#ef4444] whitespace-nowrap shrink-0"
                    >
                      <LogOut className="h-3 w-3" />
                      Sign Out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="inline-flex items-center gap-1 rounded border border-[#222a3d] bg-[#060e20] px-2.5 py-1 text-xs text-[#c2c6d6] hover:border-[#3b82f6] whitespace-nowrap shrink-0"
                    >
                      <LogIn className="h-3 w-3 text-[#60a5fa]" />
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <RecordEntryModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          currentBlockHeight={highestBlockHeight}
          onSubmitValidEntry={handleCreateLedgerEntry}
        />

        <CommandPaletteModal
          isOpen={isCmdPaletteOpen}
          onClose={() => setIsCmdPaletteOpen(false)}
          entries={allEntries}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onSelectEntryForForensics={(entry) => {
            setSelectedEntryId(entry.id);
            setActiveTab('forensics');
          }}
          onOpenRecordModal={() => setIsRecordModalOpen(true)}
        />

        <MfaOverrideModal
          isOpen={mfaModalState.isOpen}
          entry={mfaModalState.entry}
          targetStatus={mfaModalState.targetStatus}
          onClose={() => setMfaModalState((prev) => ({ ...prev, isOpen: false }))}
          onConfirmOverride={async (entry, newStatus, reason) => {
            await executeStatusTransition(entry, newStatus, reason);
          }}
        />
      </div>
    </FirestoreErrorBoundary>
  );
}
