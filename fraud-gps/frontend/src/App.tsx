import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, List, Radar, Waypoints } from 'lucide-react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { TrailStats } from './components/cards/TrailStats';
import { TimelineBar } from './components/timeline/TimelineBar';
import { ErrorState, Loading } from './components/common/Status';
import { useGraphData } from './hooks/useGraphData';
import { useTrace } from './hooks/useTrace';
import { emptyGraph, filterGraph } from './utils/graph';
import { formatCurrency } from './utils/formatters';
import type { Selection, TraceOptions, ViewMode } from './types';

const GraphCanvas = lazy(() =>
  import('./components/graph/GraphCanvas').then((module) => ({ default: module.GraphCanvas })),
);

export default function App() {
  const workspace = useGraphData();
  const investigation = useTrace();
  const [caseId, setCaseId] = useState('');
  const [options, setOptions] = useState<TraceOptions>({
    max_depth: 4,
    min_amount: '100',
    forwarding_window_hours: 24,
  });
  const [selection, setSelection] = useState<Selection>(null);
  const [suspicious, setSuspicious] = useState(false);
  const [view, setView] = useState<ViewMode>('Graph');
  const [recordsOpen, setRecordsOpen] = useState(false);
  const catalog = workspace.data?.graph;
  const complaints = workspace.data?.complaints || [];
  const selected = complaints.find((c) => c.complaint_id === caseId);
  const { reset } = investigation;
  useEffect(() => {
    setCaseId(workspace.data?.complaints[0]?.complaint_id || '');
    setSelection(null);
    reset();
  }, [workspace.data, reset]);
  function changeCase(id: string) {
    reset();
    setSelection(null);
    setCaseId(id);
    setRecordsOpen(false);
  }
  function changeOptions(next: TraceOptions) {
    reset();
    setSelection(null);
    setOptions(next);
  }
  function run() {
    if (selected && catalog) {
      setSelection(null);
      void investigation.run(caseId, options, catalog.dataset_version);
    }
  }
  function expand(id: string) {
    if (catalog && !investigation.loading) {
      setSuspicious(false);
      void investigation.expand(id, catalog.dataset_version);
    }
  }
  function searchAccount(id: string) {
    if (investigation.loading) return;
    setSelection({ kind: 'node', id });
    expand(id);
  }
  const select = useCallback((value: Selection) => setSelection(value), []);
  const graph = useMemo(
    () =>
      filterGraph(
        investigation.graph || emptyGraph(),
        suspicious,
        investigation.trace?.start_account,
      ),
    [investigation.graph, suspicious, investigation.trace],
  );
  const hidden = (investigation.graph?.nodes.length || 0) - graph.nodes.length;
  const hasContext =
    !!investigation.graph &&
    investigation.graph.edges.some(
      (e) => !investigation.trace?.steps.some((s) => s.tx_id === e.data.id),
    );
  return (
    <div className="app-shell" id="workspace">
      <Header
        complaints={complaints}
        nodes={catalog?.nodes.map((n) => n.data) || []}
        ready={!!workspace.data && !investigation.loading}
        onCase={changeCase}
        onAccount={searchAccount}
        onReload={() => {
          reset();
          setSelection(null);
          workspace.retry();
        }}
      />
      <main className="workspace">
        <Sidebar
          complaints={complaints}
          selected={selected}
          catalog={catalog}
          options={options}
          onCase={changeCase}
          onOptions={changeOptions}
          onTrace={run}
          loading={investigation.loading}
          ready={!!workspace.data}
          suspicious={suspicious}
          onSuspicious={(value) => {
            setSuspicious(value);
            setSelection(null);
          }}
          view={view}
          onView={setView}
        />
        <section className="investigation" aria-label="Transaction graph">
          <div className="investigation-title">
            <div>
              <p className="eyebrow">INVESTIGATION / MONEY TRAIL</p>
              <h1>
                Follow the money<span>.</span>
              </h1>
            </div>
            <div className="case-pill">
              <span className="status-dot" />
              {selected?.complaint_id || 'NO CASE SELECTED'}
            </div>
          </div>
          <TrailStats trace={investigation.trace} />
          <div className="graph-panel">
            <div className="graph-toolbar">
              <span>
                <Waypoints size={16} />
                <strong>
                  {view === 'Cluster'
                    ? 'Bank clusters'
                    : view === 'Route'
                      ? 'Transaction route'
                      : 'Transaction network'}
                </strong>
              </span>
              <span className="muted">
                {graph.nodes.length} accounts · {graph.edges.length} transfers
                {hidden > 0 && ` · ${hidden} hidden`}
              </span>
            </div>
            {workspace.loading ? (
              <div className="graph-message">
                <Loading>Connecting to the investigation API…</Loading>
              </div>
            ) : workspace.error ? (
              <div className="graph-message">
                <ErrorState message={workspace.error} retry={workspace.retry} />
              </div>
            ) : investigation.loading ? (
              <div className="graph-message">
                <div className="radar-loading">
                  <Radar size={50} />
                </div>
                <Loading>Following the transaction trail…</Loading>
                <p>Matching chronological transfers and source evidence.</p>
              </div>
            ) : investigation.error ? (
              <div className="graph-message">
                <ErrorState message={investigation.error} retry={run} />
              </div>
            ) : graph.nodes.length ? (
              <Suspense
                fallback={
                  <div className="graph-message">
                    <Loading>Loading graph renderer?</Loading>
                  </div>
                }
              >
                <GraphCanvas
                  graph={graph}
                  trace={investigation.trace}
                  view={view}
                  selection={selection}
                  onSelect={select}
                  onExpand={expand}
                />
              </Suspense>
            ) : (
              <div className="graph-message">
                <div className="standby-radar">
                  <Radar size={65} strokeWidth={0.8} />
                </div>
                <span className="eyebrow">
                  {investigation.trace ? 'NO MATCHING TRANSFERS' : 'READY TO INVESTIGATE'}
                </span>
                <h2>
                  {investigation.trace
                    ? 'Adjust your investigation filters'
                    : 'Every transfer leaves a trail.'}
                </h2>
                <p>
                  {investigation.trace
                    ? 'No accounts pass the current display filter.'
                    : 'Select a complaint, set your filters, and trace the flow of funds.'}
                </p>
                {suspicious && (
                  <button onClick={() => setSuspicious(false)}>Show all accounts</button>
                )}
              </div>
            )}
            {investigation.trace && !investigation.trace.steps.length && (
              <div className="empty-trail-note" role="status">
                No transfers meet the selected minimum amount. Lower the threshold and trace again.
              </div>
            )}
            {investigation.expanding && (
              <div className="graph-notice">
                <Loading>Loading neighborhood…</Loading>
              </div>
            )}
            {investigation.expansionError && (
              <div className="graph-notice">
                <ErrorState
                  message={investigation.expansionError}
                  retry={() =>
                    investigation.expansionTarget && expand(investigation.expansionTarget)
                  }
                />
              </div>
            )}
            <div className="graph-legend">
              <span>
                <i className="legend-victim" />
                Victim
              </span>
              <span>
                <i style={{ background: '#34d399' }} />
                Low
              </span>
              <span>
                <i style={{ background: '#facc15' }} />
                Medium
              </span>
              <span>
                <i style={{ background: '#fb923c' }} />
                High
              </span>
              <span>
                <i style={{ background: '#fb7185' }} />
                Critical
              </span>
              <span>
                <i className="legend-terminal" />
                Probable endpoint
              </span>
              <small>Size = risk · Cyan = traced transfer</small>
            </div>
          </div>
          <div className="below-graph">
            <button
              aria-expanded={recordsOpen}
              onClick={() => setRecordsOpen((v) => !v)}
              disabled={!graph.nodes.length}
            >
              <List size={15} />
              Browse records
              <ChevronDown size={13} />
            </button>
            <span>Scroll to zoom · Drag to pan · Right-click to expand</span>
            {hasContext && (
              <button
                onClick={() => {
                  investigation.clearExpansion();
                  setSelection(null);
                }}
              >
                Clear expansion
              </button>
            )}
          </div>
          {recordsOpen && (
            <div className="records-list" aria-label="Accessible graph records">
              <div>
                <h3>Accounts</h3>
                {graph.nodes.map((n) => (
                  <button key={n.data.id} onClick={() => select({ kind: 'node', id: n.data.id })}>
                    <span>
                      {n.data.label} · {n.data.holder_name}
                    </span>
                    <small>
                      {n.data.id} · {n.data.bank_name} · {n.data.role}
                    </small>
                  </button>
                ))}
              </div>
              <div>
                <h3>Transfers</h3>
                {graph.edges.map((e) => (
                  <button key={e.data.id} onClick={() => select({ kind: 'edge', id: e.data.id })}>
                    <span>
                      {e.data.id} · {formatCurrency(e.data.amount)}
                    </span>
                    <small>
                      {e.data.channel} · {e.data.attributed_amount === null ? 'Context' : 'Traced'}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <InspectorPanel
          key={`${caseId}:${selection?.kind}:${selection?.id}`}
          selection={selection}
          graph={investigation.graph}
          catalog={catalog}
          trace={investigation.trace}
          onClose={() => setSelection(null)}
          onExpand={expand}
          expanding={investigation.expanding}
        />
      </main>
      <TimelineBar trace={investigation.trace} ready={!!workspace.data} />
    </div>
  );
}
