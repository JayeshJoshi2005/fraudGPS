import { useState } from 'react';
import { FileDown, Radar, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import type { Complaint, GraphNode } from '../../types';

interface Props {
  complaints: Complaint[];
  nodes: GraphNode[];
  ready: boolean;
  onCase: (id: string) => void;
  onAccount: (id: string) => void;
  onReload: () => void;
}
export function Header({ complaints, nodes, ready, onCase, onAccount, onReload }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const search = query.trim().toLowerCase();
  const cases = search
    ? complaints.filter((c) => `${c.complaint_id} ${c.victim_name}`.toLowerCase().includes(search))
    : [];
  const accounts = search
    ? nodes.filter((n) => `${n.id} ${n.label} ${n.holder_name}`.toLowerCase().includes(search))
    : [];
  return (
    <header className="header">
      <a className="brand" href="#workspace" aria-label="Fraud GPS workspace">
        <span className="brand-symbol">
          <Radar size={25} />
        </span>
        <div>
          Fraud <strong>GPS</strong>
          <small>POWERED BY FRAUD DNA</small>
        </div>
      </a>
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
      <span className="risk-count" title="Accounts with risk score at least 0.50">
        <ShieldAlert size={16} />
        {nodes.filter((n) => n.risk_score >= 0.5).length}
        <span>high risk</span>
      </span>
      <button
        className="reload-button"
        aria-label="Reload workspace"
        title="Reload dataset and cases"
        onClick={onReload}
      >
        <RefreshCw size={15} />
      </button>
      <button className="report-button" disabled title="Reports are not available yet">
        <FileDown size={15} />
        Generate Report
      </button>
    </header>
  );
}
