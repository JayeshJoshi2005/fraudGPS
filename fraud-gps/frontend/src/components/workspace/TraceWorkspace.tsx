import { lazy, Suspense } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Dna,
  List,
  Maximize2,
  Minimize2,
  PanelRight,
  Pause,
  Radar,
  RotateCcw,
  Waypoints,
  X,
} from 'lucide-react';
import type { InvestigationWorkspace } from '../../hooks/useInvestigationWorkspace';
import { ErrorState, Loading } from '../common/Status';
import { InspectorPanel } from '../layout/InspectorPanel';
import { TimelineBar } from '../timeline/TimelineBar';
import { TrailStats } from '../cards/TrailStats';
import { formatCurrency } from '../../utils/formatters';
const GraphCanvas = lazy(() =>
  import('../graph/GraphCanvas').then((module) => ({ default: module.GraphCanvas })),
);

export function TraceWorkspace({ model: m }: { model: InvestigationWorkspace }) {
  const { investigation: i, playback } = m;
  const transferCount = m.graph.edges.filter((edge) => edge.data.kind === 'transaction').length;
  const relationCount = m.graph.edges.length - transferCount;
  const hidden = m.combinedGraph.nodes.length - m.graph.nodes.length;
  const hasContext =
    !!i.graph &&
    i.graph.edges.some((edge) => !i.trace?.steps.some((step) => step.tx_id === edge.data.id));
  return (
    <section className="trace-module" id="trace-panel" role="tabpanel" aria-labelledby="trace-tab">
      <div className="workspace trace-grid">
        <section className="investigation" aria-label="Transaction graph">
          <div className="investigation-title">
            <div className="workspace-title">
              <p className="eyebrow">FOLLOW THE FLOW</p>
              <h1>
                Money trail<span>{m.selected?.complaint_id}</span>
              </h1>
            </div>
            <TrailStats trace={i.trace} compact />
            <div className="workspace-actions">
              <button
                className="primary trace-again"
                onClick={m.run}
                disabled={!m.selected || i.loading}
                aria-label="Trace Funds"
              >
                {i.loading ? 'Tracing…' : i.trace ? 'Trace again' : 'Trace Funds'}
                <ArrowRight size={15} />
              </button>
              <button
                aria-label="Show inspector"
                aria-expanded={m.inspectorOpen}
                aria-controls="evidence-inspector"
                onClick={() => m.setInspectorOpen(!m.inspectorOpen)}
                title="Account evidence"
              >
                <PanelRight size={16} />
              </button>
              <button
                aria-label={m.focusMode ? 'Restore panels' : 'Expand graph'}
                aria-pressed={m.focusMode}
                onClick={() => {
                  m.setFocusMode(!m.focusMode);
                  m.setControlsOpen(false);
                  m.setInspectorOpen(false);
                  m.setRecordsOpen(false);
                }}
                title={m.focusMode ? 'Restore navigation' : 'Focus on the graph'}
              >
                {m.focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
          <div className="graph-panel">
            <div className="graph-toolbar">
              <span>
                <Waypoints size={16} />
                <strong>
                  {m.view === 'Cluster'
                    ? 'Bank clusters'
                    : m.view === 'Route'
                      ? 'Transaction route'
                      : 'Transaction network'}
                </strong>
                <small>
                  {m.graph.nodes.length} accounts · {transferCount} transfers
                  {relationCount > 0 && ` · ${relationCount} identifier links`}
                  {hidden > 0 && ` · ${hidden} hidden`}
                </small>
              </span>
              <div className="graph-module-actions">
                <button
                  aria-label={playback.playing ? 'Pause replay' : 'Replay Trail'}
                  onClick={() => playback.dispatch({ type: playback.playing ? 'pause' : 'replay' })}
                  disabled={!m.timeline.events.length}
                  title="Replay the chronological trail"
                >
                  {playback.playing ? <Pause size={14} /> : <RotateCcw size={14} />}
                  <span>{playback.playing ? 'Pause replay' : 'Replay Trail'}</span>
                </button>
                <button
                  aria-label="Find Linked Cases"
                  onClick={m.analyzeDNA}
                  disabled={!i.trace?.steps.length || m.dna.loading}
                >
                  <Dna size={14} />
                  <span>Find Linked Cases</span>
                </button>
              </div>
            </div>
            {m.workspace.loading ? (
              <div className="graph-message">
                <Loading>Connecting to the investigation API…</Loading>
              </div>
            ) : m.workspace.error ? (
              <div className="graph-message">
                <ErrorState message={m.workspace.error} retry={m.workspace.retry} />
              </div>
            ) : i.loading ? (
              <div className="graph-message">
                <div className="radar-loading">
                  <Radar size={50} />
                </div>
                <Loading>Following the transaction trail…</Loading>
                <p>Matching chronological transfers and source evidence.</p>
              </div>
            ) : i.error ? (
              <div className="graph-message">
                <ErrorState message={i.error} retry={m.run} />
              </div>
            ) : m.graph.nodes.length ? (
              <Suspense
                fallback={
                  <div className="graph-message">
                    <Loading>Loading graph renderer…</Loading>
                  </div>
                }
              >
                <GraphCanvas
                  active={m.navigation.section === 'trace'}
                  graph={m.graph}
                  trace={i.trace}
                  view={m.view}
                  selection={m.selection}
                  onSelect={m.select}
                  onExpand={m.expand}
                  story={m.story}
                  playback={playback}
                  fitRevision={m.fitRevision}
                  focusRequest={m.focusRequest}
                  dna={m.showDNA ? m.dna.data : undefined}
                  focusedEntity={m.focusedEntity}
                  onHideDNA={() => {
                    m.setShowDNA(false);
                    m.setSelection(null);
                  }}
                />
              </Suspense>
            ) : (
              <div className="graph-message">
                <div className="standby-radar">
                  <Radar size={65} strokeWidth={0.8} />
                </div>
                <span className="eyebrow">
                  {i.trace ? 'NO MATCHING TRANSFERS' : 'READY TO INVESTIGATE'}
                </span>
                <h2>
                  {i.trace ? 'Adjust your investigation filters' : 'Every transfer leaves a trail.'}
                </h2>
                <p>
                  {i.trace
                    ? 'No accounts pass the current display filter.'
                    : "Select a complaint and click 'Trace Funds' to begin investigation."}
                </p>
                {m.suspicious && (
                  <button onClick={() => m.setSuspicious(false)}>Show all accounts</button>
                )}
              </div>
            )}
            {i.trace && !i.trace.steps.length && (
              <div className="empty-trail-note" role="status">
                <strong>No money trail found for this complaint. </strong>No transfers meet the
                selected minimum amount. Lower the threshold and trace again.
              </div>
            )}
            {i.expanding && (
              <div className="graph-notice">
                <Loading>Loading neighborhood…</Loading>
              </div>
            )}
            {i.expansionError && (
              <div className="graph-notice">
                <ErrorState
                  message={i.expansionError}
                  retry={() => i.expansionTarget && m.expand(i.expansionTarget)}
                />
              </div>
            )}
            <div className="graph-legend">
              <span>
                <i className="legend-victim" />
                Victim
              </span>
              {[
                ['#34d399', 'Low'],
                ['#facc15', 'Medium'],
                ['#fb923c', 'High'],
                ['#fb7185', 'Critical'],
              ].map(([color, label]) => (
                <span key={label}>
                  <i style={{ background: color }} />
                  {label}
                </span>
              ))}
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
            <button onClick={() => m.navigation.navigate('summary')} disabled={!i.trace}>
              Case summary
              <ArrowRight size={12} />
            </button>
            <button
              aria-expanded={m.recordsOpen}
              onClick={() => m.setRecordsOpen(!m.recordsOpen)}
              disabled={!m.graph.nodes.length}
            >
              <List size={15} />
              Browse records
              <ChevronDown size={13} />
            </button>
            <span>Scroll to zoom · Drag to pan · Right-click to expand</span>
            {hasContext && (
              <button
                onClick={() => {
                  i.clearExpansion();
                  m.setSelection(null);
                }}
              >
                Clear expansion
              </button>
            )}
            {m.dna.data && (
              <button
                onClick={() => {
                  m.setShowDNA(!m.showDNA);
                  m.setSelection(null);
                }}
              >
                {m.showDNA ? 'Hide DNA links' : 'Show DNA links'}
              </button>
            )}
          </div>
          {m.recordsOpen && (
            <div className="records-list" aria-label="Accessible graph records">
              <div>
                <h3>Accounts</h3>
                {m.graph.nodes.map(({ data }) => (
                  <button key={data.id} onClick={() => m.select({ kind: 'node', id: data.id })}>
                    <span>
                      {data.label} · {data.holder_name}
                    </span>
                    <small>
                      {data.id} · {data.bank_name} · {data.role}
                    </small>
                  </button>
                ))}
              </div>
              <div>
                <h3>{relationCount ? 'Transfers and identifier links' : 'Transfers'}</h3>
                {m.graph.edges.map(({ data }) => (
                  <button key={data.id} onClick={() => m.select({ kind: 'edge', id: data.id })}>
                    <span>
                      {data.id} ·{' '}
                      {data.kind === 'transaction'
                        ? formatCurrency(data.amount)
                        : 'Shared identifier'}
                    </span>
                    <small>
                      {data.kind === 'transaction'
                        ? `${data.channel} · ${data.attributed_amount === null ? 'Context' : 'Traced'}`
                        : `${data.complaint_ids.length} other cases · Not a transfer`}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        {m.inspectorOpen && (
          <aside id="evidence-inspector" className="inspector panel" aria-label="Inspector">
            <div className="inspector-topline">
              <span>ACCOUNT EVIDENCE</span>
              <button
                className="icon-button"
                aria-label="Hide inspector panel"
                onClick={() => m.setInspectorOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <InspectorPanel
              key={`${m.caseId}:${m.selection?.kind}:${m.selection?.id}`}
              selection={m.selection}
              graph={m.combinedGraph}
              catalog={m.catalog}
              trace={i.trace}
              onClose={() => {
                m.setSelection(null);
                m.setInspectorOpen(false);
              }}
              onExpand={m.expand}
              expanding={i.expanding}
            />
          </aside>
        )}
      </div>
      <TimelineBar
        trace={i.trace}
        ready={!!m.workspace.data}
        events={m.timeline.events}
        playback={playback}
        dispatch={playback.dispatch}
        loading={m.timeline.loading}
        error={m.timeline.error}
        retry={m.timeline.retry}
      />
    </section>
  );
}
