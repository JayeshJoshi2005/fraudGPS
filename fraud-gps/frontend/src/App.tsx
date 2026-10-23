import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  List,
  Radar,
  Waypoints,
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { TrailStats } from './components/cards/TrailStats';
import { TimelineBar } from './components/timeline/TimelineBar';
import { ErrorState, Loading } from './components/common/Status';
import { useGraphData } from './hooks/useGraphData';
import { useTrace } from './hooks/useTrace';
import { useTimeline } from './hooks/useTimeline';
import { usePlayback } from './hooks/usePlayback';
import { useDNA } from './hooks/useDNA';
import { DNAPanel } from './components/dna/DNAPanel';
import { projectStory } from './utils/playback';
import { emptyGraph, filterGraph, mergeGraphs } from './utils/graph';
import { formatCurrency } from './utils/formatters';
import type { Selection, TraceOptions, ViewMode } from './types';

const GraphCanvas = lazy(() =>
  import('./components/graph/GraphCanvas').then((module) => ({ default: module.GraphCanvas })),
);

export default function App() {
  const workspace = useGraphData();
  const investigation = useTrace();
  const dna = useDNA(investigation.trace);
  const timeline = useTimeline(investigation.trace);
  const playback = usePlayback(timeline.events);
  const story = useMemo(
    () =>
      investigation.trace && playback.mode === 'story'
        ? projectStory(timeline.events, playback.step, investigation.trace)
        : undefined,
    [timeline.events, playback.mode, playback.step, investigation.trace],
  );
  const [caseId, setCaseId] = useState('');
  const [options, setOptions] = useState<TraceOptions>({
    max_depth: 4,
    min_amount: '100',
    forwarding_window_hours: 24,
  });
  const [selection, setSelection] = useState<Selection>(null);
  const [suspicious, setSuspicious] = useState(false);
  const [view, setView] = useState<ViewMode>('Route');
  const [controlsOpen, setControlsOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'account' | 'dna'>('account');
  const [showDNA, setShowDNA] = useState(true);
  const [focusedEntity, setFocusedEntity] = useState<string>();
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1440px)');
    const adjustPanels = () => {
      if (compact.matches && inspectorOpen) setControlsOpen(false);
    };
    adjustPanels();
    compact.addEventListener('change', adjustPanels);
    return () => compact.removeEventListener('change', adjustPanels);
  }, [inspectorOpen]);
  useEffect(() => {
    setInspectorTab('account');
    setShowDNA(true);
    setFocusedEntity(undefined);
  }, [investigation.trace]);
  const catalog = workspace.data?.graph;
  const complaints = workspace.data?.complaints || [];
  const selected = complaints.find((c) => c.complaint_id === caseId);
  const { reset } = investigation;
  useEffect(() => {
    setCaseId(workspace.data?.complaints[0]?.complaint_id || '');
    setSelection(null);
    setInspectorOpen(false);
    reset();
  }, [workspace.data, reset]);
  function changeCase(id: string) {
    reset();
    setSelection(null);
    setCaseId(id);
    setRecordsOpen(false);
    setInspectorOpen(false);
    setControlsOpen(true);
  }
  function changeOptions(next: TraceOptions) {
    reset();
    setSelection(null);
    setOptions(next);
    setInspectorOpen(false);
  }
  function run() {
    if (selected && catalog) {
      setSelection(null);
      setInspectorOpen(false);
      if (window.matchMedia('(max-width: 800px)').matches) setControlsOpen(false);
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
    setInspectorTab('account');
    setInspectorOpen(true);
    expand(id);
  }
  const select = useCallback((value: Selection) => {
    setSelection(value);
    if (value) {
      setInspectorTab('account');
      setInspectorOpen(true);
    }
  }, []);
  function analyzeDNA() {
    playback.dispatch({ type: 'overview' });
    setInspectorTab('dna');
    setInspectorOpen(true);
    setShowDNA(true);
    setFocusedEntity(undefined);
    void dna.run();
  }
  function investigateLinkedCase(id: string) {
    if (!catalog) return;
    changeCase(id);
    if (window.matchMedia('(max-width: 800px)').matches) setControlsOpen(false);
    setInspectorTab('account');
    void investigation.run(id, options, catalog.dataset_version);
  }
  const combinedGraph = useMemo(() => {
    const base = investigation.graph || emptyGraph();
    return dna.data && showDNA ? mergeGraphs(base, dna.data.link_graph) : base;
  }, [investigation.graph, dna.data, showDNA]);
  const graph = useMemo(
    () => filterGraph(combinedGraph, suspicious, investigation.trace?.start_account),
    [combinedGraph, suspicious, investigation.trace],
  );
  const hidden = combinedGraph.nodes.length - graph.nodes.length;
  const transferCount = graph.edges.filter((edge) => edge.data.kind === 'transaction').length;
  const relationCount = graph.edges.length - transferCount;
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
      <main
        className={`workspace ${controlsOpen ? 'controls-open' : ''} ${inspectorOpen ? 'inspector-open' : ''}`}
      >
        <div id="case-controls" className="case-controls" hidden={!controlsOpen}>
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
            trace={investigation.trace}
            replayReady={!!timeline.events.length}
            playing={playback.playing}
            onReplay={() => playback.dispatch({ type: playback.playing ? 'pause' : 'replay' })}
            onDNA={analyzeDNA}
            dnaLoading={dna.loading}
          />
        </div>
        <section className="investigation" aria-label="Transaction graph">
          <div className="investigation-title">
            <div className="workspace-title">
              <h1>Money trail</h1>
              <span className="case-reference">{selected?.complaint_id || 'Select a case'}</span>
            </div>
            <TrailStats trace={investigation.trace} compact />
            <div className="workspace-actions">
              <button
                aria-label="Case controls"
                aria-expanded={controlsOpen}
                aria-controls="case-controls"
                onClick={() => {
                  if (!controlsOpen && window.matchMedia('(max-width: 1440px)').matches)
                    setInspectorOpen(false);
                  setControlsOpen((open) => !open);
                }}
                title="Show or hide case controls"
              >
                <PanelLeft size={16} />
                <span>Cases</span>
              </button>
              <button
                aria-label="Show inspector"
                aria-expanded={inspectorOpen}
                aria-controls="evidence-inspector"
                onClick={() => setInspectorOpen((open) => !open)}
                title="Show or hide evidence inspector"
              >
                <PanelRight size={16} />
                <span>Inspector</span>
              </button>
              <button
                aria-label={!controlsOpen && !inspectorOpen ? 'Restore panels' : 'Expand graph'}
                aria-pressed={!controlsOpen && !inspectorOpen}
                onClick={() => {
                  if (!controlsOpen && !inspectorOpen) setControlsOpen(true);
                  else {
                    setControlsOpen(false);
                    setInspectorOpen(false);
                    setRecordsOpen(false);
                  }
                }}
                title={
                  !controlsOpen && !inspectorOpen
                    ? 'Restore panels'
                    : 'Give the graph the full workspace'
                }
              >
                {!controlsOpen && !inspectorOpen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
            </div>
          </div>
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
                {graph.nodes.length} accounts · {transferCount} transfers
                {relationCount > 0 && ` · ${relationCount} identifier links`}
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
                  story={story}
                  playback={playback}
                  dna={showDNA ? dna.data : undefined}
                  focusedEntity={focusedEntity}
                  onHideDNA={() => {
                    setShowDNA(false);
                    setSelection(null);
                  }}
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
              {relationCount > 0 && (
                <span className="dna-legend">
                  <i />
                  Purple dashes = shared identifier · no transfer
                </span>
              )}
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
            {dna.data && (
              <button
                onClick={() => {
                  setShowDNA((value) => !value);
                  setSelection(null);
                }}
              >
                {showDNA ? 'Hide DNA links' : 'Show DNA links'}
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
                <h3>{relationCount ? 'Transfers and identifier links' : 'Transfers'}</h3>
                {graph.edges.map((e) => (
                  <button key={e.data.id} onClick={() => select({ kind: 'edge', id: e.data.id })}>
                    <span>
                      {e.data.id} ·{' '}
                      {e.data.kind === 'transaction'
                        ? formatCurrency(e.data.amount)
                        : 'Shared identifier'}
                    </span>
                    <small>
                      {e.data.kind === 'transaction'
                        ? `${e.data.channel} · ${e.data.attributed_amount === null ? 'Context' : 'Traced'}`
                        : `${e.data.complaint_ids.length} other cases · Not a transfer`}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <aside
          id="evidence-inspector"
          className="inspector panel"
          aria-label="Inspector"
          hidden={!inspectorOpen}
        >
          <div className="inspector-topline">
            <span>Evidence & connections</span>
            <button
              className="icon-button"
              aria-label="Hide inspector panel"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="inspector-tabs" role="tablist" aria-label="Investigation panels">
            {(['account', 'dna'] as const).map((tab) => (
              <button
                role="tab"
                key={tab}
                id={`${tab}-tab`}
                aria-controls={`${tab}-panel`}
                aria-selected={inspectorTab === tab}
                tabIndex={inspectorTab === tab ? 0 : -1}
                onClick={() => setInspectorTab(tab)}
                onKeyDown={(event) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 'account'
                        : event.key === 'End'
                          ? 'dna'
                          : tab === 'account'
                            ? 'dna'
                            : 'account';
                    setInspectorTab(next);
                    document.getElementById(`${next}-tab`)?.focus();
                  }
                }}
              >
                {tab === 'account' ? 'Account Inspector' : 'Fraud DNA'}
              </button>
            ))}
          </div>
          {inspectorTab === 'account' ? (
            <InspectorPanel
              key={`${caseId}:${selection?.kind}:${selection?.id}`}
              selection={selection}
              graph={combinedGraph}
              catalog={catalog}
              trace={investigation.trace}
              onClose={() => {
                setSelection(null);
                setInspectorOpen(false);
              }}
              onExpand={expand}
              expanding={investigation.expanding}
            />
          ) : (
            <DNAPanel
              key={caseId}
              report={dna.data}
              trace={investigation.trace}
              catalog={catalog}
              loading={dna.loading}
              error={dna.error}
              onAnalyze={analyzeDNA}
              onCase={investigateLinkedCase}
              onAccount={(id) => {
                select({ kind: 'node', id });
                if (!combinedGraph.nodes.some((node) => node.data.id === id)) expand(id);
              }}
              focusedEntity={focusedEntity}
              onEntity={setFocusedEntity}
            />
          )}
        </aside>
      </main>
      <TimelineBar
        trace={investigation.trace}
        ready={!!workspace.data}
        events={timeline.events}
        playback={playback}
        dispatch={playback.dispatch}
        loading={timeline.loading}
        error={timeline.error}
        retry={timeline.retry}
      />
    </div>
  );
}
