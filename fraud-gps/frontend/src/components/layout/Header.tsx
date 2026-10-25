import { useEffect, useRef, useState } from 'react';
import {
  FileDown,
  Keyboard,
  LoaderCircle,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Complaint, GraphNode } from '../../types';
import { AlertPanel } from '../alerts/AlertPanel';
import { keyboardShortcuts } from '../../utils/shortcuts';

interface Props {
  complaints: Complaint[];
  nodes: GraphNode[];
  ready: boolean;
  onCase: (id: string) => void;
  onAccount: (id: string) => void;
  onReload: () => void;
  datasetVersion?: string;
  reportReady: boolean;
  reportLoading: boolean;
  reportError?: string;
  onReport: () => void;
  caseId: string;
  onSettings: () => void;
  settingsOpen: boolean;
}
export function Header({
  complaints,
  nodes,
  ready,
  onCase,
  onAccount,
  onReload,
  datasetVersion,
  reportReady,
  reportLoading,
  reportError,
  onReport,
  caseId,
  onSettings,
  settingsOpen,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const alerts = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setAlertsOpen(false);
    setHelpOpen(false);
  }, [datasetVersion]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!alerts.current?.contains(event.target)) setAlertsOpen(false);
      if (!help.current?.contains(event.target)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const search = query.trim().toLowerCase();
  const cases = search
    ? complaints.filter((c) => `${c.complaint_id} ${c.victim_name}`.toLowerCase().includes(search))
    : [];
  const accounts = search
    ? nodes.filter((n) => `${n.id} ${n.label} ${n.holder_name}`.toLowerCase().includes(search))
    : [];
  return (
    <header
      className="header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (alertsOpen || helpOpen)) {
          event.preventDefault();
          setAlertsOpen(false);
          setHelpOpen(false);
        }
      }}
    >
      <a className="brand" href="#/cases" aria-label="Fraud GPS workspace">
        <span className="brand-symbol">
          <Radar size={25} />
        </span>
        <div>
          Fraud <strong>GPS</strong>
          <small>POWERED BY FRAUD DNA</small>
        </div>
      </a>
      <label className="header-case-select">
        <span>ACTIVE CASE</span>
        <select
          aria-label="SELECT COMPLAINT"
          value={caseId}
          onChange={(event) => onCase(event.target.value)}
          disabled={!complaints.length}
        >
          <option value="" disabled>
            Choose a complaint
          </option>
          {complaints.map((item) => (
            <option key={item.complaint_id} value={item.complaint_id}>
              {item.complaint_id} · {item.victim_name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="search-wrap"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <Search size={17} />
        <input
          aria-label="Search complaints and accounts"
          placeholder="Search complaint ID, account, or name…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          disabled={!ready}
        />
        <kbd>SEARCH</kbd>
        {open && search && (
          <div className="search-results">
            <p className="eyebrow">{cases.length + accounts.length} matching records</p>
            {cases.slice(0, 4).map((c) => (
              <button
                key={c.complaint_id}
                onClick={() => {
                  onCase(c.complaint_id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span>
                  {c.complaint_id}
                  <small>{c.victim_name}</small>
                </span>
                <span className="muted">Case</span>
              </button>
            ))}
            {accounts.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  onAccount(n.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span>
                  {n.label} · {n.holder_name}
                  <small>{n.id}</small>
                </span>
                <span className="muted">Account</span>
              </button>
            ))}
            {!cases.length && !accounts.length && (
              <p className="muted">No matching cases or accounts.</p>
            )}
          </div>
        )}
      </div>
      <div className="header-popover-anchor alert-control" ref={alerts}>
        <button
          className="risk-count"
          aria-label="High-risk alerts"
          aria-expanded={alertsOpen}
          disabled={!ready}
          title="Accounts with risk score at least 0.50"
          onClick={() => {
            setAlertsOpen((value) => !value);
            setHelpOpen(false);
          }}
        >
          <ShieldAlert size={16} />
          {nodes.filter((n) => n.risk_score >= 0.5).length}
          <span>high risk</span>
        </button>
        {alertsOpen && datasetVersion && (
          <AlertPanel
            version={datasetVersion}
            nodes={nodes}
            onAccount={onAccount}
            onClose={() => setAlertsOpen(false)}
          />
        )}
      </div>
      <div
        className="header-popover-anchor shortcuts-control"
        ref={help}
        onMouseEnter={() => setHelpOpen(true)}
        onMouseLeave={() => {
          if (!help.current?.contains(document.activeElement)) setHelpOpen(false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
        }}
      >
        <button
          aria-label="Keyboard shortcuts"
          aria-expanded={helpOpen}
          aria-controls="shortcut-help"
          onClick={() => {
            setHelpOpen(true);
            setAlertsOpen(false);
          }}
        >
          <Keyboard size={17} />
        </button>
        {helpOpen && (
          <section className="shortcut-help" id="shortcut-help" aria-label="Keyboard shortcuts">
            <div>
              <strong>Keyboard shortcuts</strong>
              <button aria-label="Close shortcuts" onClick={() => setHelpOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <dl>
              {keyboardShortcuts.map(([key, value]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>Available outside form controls.</p>
          </section>
        )}
      </div>
      <button
        className="settings-button"
        aria-label="Case controls"
        aria-expanded={settingsOpen}
        aria-controls="case-controls"
        onClick={onSettings}
        title="Case settings and filters"
      >
        <SlidersHorizontal size={17} />
      </button>
      <button
        className="reload-button"
        aria-label="Reload workspace"
        title="Reload dataset and cases"
        onClick={onReload}
      >
        <RefreshCw size={15} />
      </button>
      <div className="report-control">
        <button
          className="report-button"
          aria-label="Generate Report"
          disabled={!reportReady || reportLoading}
          title={
            reportLoading
              ? 'Generating forensic report…'
              : 'Download the current case investigation PDF'
          }
          onClick={onReport}
        >
          {reportLoading ? <LoaderCircle size={15} className="spin" /> : <FileDown size={15} />}
          <span className="report-button-label">
            {reportLoading ? 'Generating forensic report…' : 'Generate Report'}
          </span>
        </button>
        {reportError && (
          <div className="report-download-error" role="alert">
            <p>{reportError}</p>
            <button onClick={onReport}>Retry report</button>
          </div>
        )}
      </div>
    </header>
  );
}
