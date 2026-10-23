import { ArrowRight, Dna, FolderSearch, SlidersHorizontal, Pause, RotateCcw } from 'lucide-react';
import type { Complaint, GraphData, TraceOptions, TraceResult, ViewMode } from '../../types';
import { formatCurrency, formatDate, maskAccount } from '../../utils/formatters';
import { Badge, Loading } from '../common/Status';
import { TrailStats } from '../cards/TrailStats';

interface Props {
  complaints: Complaint[];
  selected?: Complaint;
  catalog?: GraphData;
  options: TraceOptions;
  onCase: (id: string) => void;
  onOptions: (options: TraceOptions) => void;
  onTrace: () => void;
  loading: boolean;
  ready: boolean;
  suspicious: boolean;
  onSuspicious: (value: boolean) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  trace?: TraceResult;
  replayReady: boolean;
  playing: boolean;
  onReplay: () => void;
  onDNA: () => void;
  dnaLoading: boolean;
}
export function Sidebar(p: Props) {
  const victim = p.catalog?.nodes.find((n) => n.data.id === p.selected?.victim_account)?.data;
  return (
    <aside className="sidebar panel" aria-label="Case selection and filters">
      <div className="panel-heading">
        <FolderSearch size={17} />
        <h2>Case workspace</h2>
      </div>
      <div className="panel-body">
        <label className="field-label" htmlFor="complaint">
          SELECT COMPLAINT
        </label>
        <select
          id="complaint"
          value={p.selected?.complaint_id || ''}
          onChange={(e) => p.onCase(e.target.value)}
          disabled={!p.ready}
        >
          <option value="" disabled>
            {p.ready ? 'Choose a complaint' : 'Loading complaints…'}
          </option>
          {p.complaints.map((c) => (
            <option key={c.complaint_id} value={c.complaint_id}>
              {c.complaint_id} · {c.victim_name}
            </option>
          ))}
        </select>
        {p.selected ? (
          <article className="case-card">
            <div className="case-top">
              <span className="eyebrow">REPORTED LOSS</span>
              <Badge text={p.selected.status} />
            </div>
            <div className="loss-amount">{formatCurrency(p.selected.amount_lost)}</div>
            <div className="victim-name">{p.selected.victim_name}</div>
            <p className="muted mono">
              {maskAccount(victim?.label)} <span>·</span> {p.selected.victim_bank}
            </p>
            <div className="case-meta">
              <span>{p.selected.scam_type}</span>
              <span>{formatDate(p.selected.complaint_date)}</span>
            </div>
            <details className="case-description">
              <summary>Complaint details</summary>
              <p>{p.selected.description}</p>
            </details>
          </article>
        ) : (
          <p className="muted">Select a case to begin investigating its money trail.</p>
        )}
        <button
          className="primary trace-button"
          onClick={p.onTrace}
          disabled={!p.selected || !p.ready || p.loading}
        >
          {p.loading ? (
            <Loading>Tracing funds…</Loading>
          ) : (
            <>
              Trace Funds <ArrowRight size={17} />
            </>
          )}
        </button>
        <button className="replay-button" disabled={!p.replayReady} onClick={p.onReplay}>
          {p.playing ? <Pause size={16} /> : <RotateCcw size={16} />}
          {p.playing ? 'Pause replay' : 'Replay Trail'}
        </button>
        <button
          className="dna-button"
          disabled={!p.trace?.steps.length || p.dnaLoading}
          onClick={p.onDNA}
        >
          {p.dnaLoading ? (
            <Loading>Comparing DNA…</Loading>
          ) : (
            <>
              <Dna size={17} />
              Find Linked Cases
            </>
          )}
        </button>
        <div className="section-title">
          <SlidersHorizontal size={15} />
          <h3>Investigation filters</h3>
        </div>
        <label className="toggle-row">
          <span>
            Only suspicious accounts<small>Risk ≥ 0.50 + victim</small>
          </span>
          <input
            aria-label="Show only suspicious nodes"
            type="checkbox"
            checked={p.suspicious}
            onChange={(e) => p.onSuspicious(e.target.checked)}
          />
        </label>
        <label className="slider-label" htmlFor="depth">
          Trace depth <output>{p.options.max_depth} hops</output>
        </label>
        <input
          id="depth"
          aria-label="Trace depth"
          type="range"
          min="1"
          max="7"
          value={p.options.max_depth}
          onChange={(e) => p.onOptions({ ...p.options, max_depth: Number(e.target.value) })}
        />
        <div className="range-ends">
          <span>1 hop</span>
          <span>7 hops</span>
        </div>
        <label className="slider-label" htmlFor="min-amount">
          Minimum transfer <output>{formatCurrency(p.options.min_amount)}</output>
        </label>
        <input
          id="min-amount"
          aria-label="Minimum amount"
          type="range"
          min="0"
          max="100000"
          step="100"
          value={p.options.min_amount}
          onChange={(e) => p.onOptions({ ...p.options, min_amount: e.target.value })}
        />
        <div className="range-ends">
          <span>₹0</span>
          <span>₹1,00,000</span>
        </div>
        <label className="field-label" htmlFor="view">
          VIEW MODE
        </label>
        <select id="view" value={p.view} onChange={(e) => p.onView(e.target.value as ViewMode)}>
          <option>Graph</option>
          <option>Route</option>
          <option>Cluster</option>
        </select>
        <p className="filter-note">
          {p.view === 'Cluster'
            ? 'Groups accounts by bank. These groups are not inferred fraud campaigns.'
            : p.view === 'Route'
              ? 'Follow transfers from left to right. Each arrow is a distinct transaction.'
              : 'Explore connections with a force-directed layout.'}
        </p>
        <p className="filter-note">
          Depth and amount changes clear the previous trail. Select Trace Funds to apply.
        </p>
        {p.trace && (
          <details className="trail-details">
            <summary>Full trail statistics</summary>
            <TrailStats trace={p.trace} />
          </details>
        )}
      </div>
      <div className="sidebar-footer">
        <span className="status-dot" />
        SYNTHETIC DATA · LOCAL ANALYSIS
      </div>
    </aside>
  );
}
