import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { Core, EventObject, LayoutOptions } from 'cytoscape';
import { Maximize, Minus, Plus, RotateCcw, Dna, X } from 'lucide-react';
import type { DNAReport } from '../../types/dna';
import { percent } from '../../utils/dna';
import type { GraphData, Selection, TraceResult, ViewMode, PlaybackState } from '../../types';
import type { StoryFrame } from '../../utils/playback';
import { formatCurrency } from '../../utils/formatters';
import { animateStory, applyStoryFrame } from './graphAnimations';
import { flowPositions } from '../../utils/graphLayout';
import { graphStyles, riskColor } from './graphStyles';
import { StoryOverlay } from './StoryOverlay';

function frameGraph(cy: Core, readable = false) {
  cy.fit(undefined, 55);
  if (readable && cy.width() < 640 && cy.zoom() < 0.65) {
    const root = cy.nodes('[role = "Victim"]').first();
    const anchor = root.empty() ? cy.nodes().first() : root;
    if (anchor.empty()) return;
    const position = anchor.position();
    cy.zoom(0.65);
    cy.pan({ x: 60 - position.x * 0.65, y: cy.height() / 2 - position.y * 0.65 });
  }
}

interface Props {
  graph: GraphData;
  trace?: TraceResult;
  view: ViewMode;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onExpand: (id: string) => void;
  story?: StoryFrame;
  playback: PlaybackState;
  dna?: DNAReport;
  focusedEntity?: string;
  onHideDNA: () => void;
}
export function GraphCanvas({
  graph,
  trace,
  view,
  selection,
  onSelect,
  onExpand,
  story,
  playback,
  dna,
  focusedEntity,
  onHideDNA,
}: Props) {
  const [cy, setCy] = useState<Core | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    text: string;
  } | null>(null);
  const [context, setContext] = useState<{ x: number; y: number; id: string } | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const receiveCore = useCallback((core: Core) => setCy((old) => (old === core ? old : core)), []);
  const elements = useMemo(() => {
    const trail = new Set(trace?.steps.map((s) => s.tx_id) || []);
    const risky = new Set(
      graph.nodes.filter((n) => n.data.risk_score >= 0.5).map((n) => n.data.id),
    );
    return [
      ...graph.nodes.map((n) => ({
        data: { ...n.data, color: riskColor(n.data.risk_score), size: 42 + n.data.risk_score * 18 },
      })),
      ...graph.edges.map((e) => ({
        data: {
          ...e.data,
          width:
            e.data.kind === 'transaction'
              ? Math.max(2, Math.min(4, Math.log10(Math.max(1, Number(e.data.amount))) - 1))
              : 2,
        },
        classes:
          e.data.kind === 'entity_link'
            ? 'dna-link'
            : `${trail.has(e.data.id) ? 'trail' : ''} ${risky.has(e.data.source) || risky.has(e.data.target) ? 'suspicious' : ''}`,
      })),
    ];
  }, [graph, trace]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    const tap = (event: EventObject) => {
      setContext(null);
      if (event.target === cy) onSelect(null);
      else onSelect({ kind: event.target.isNode() ? 'node' : 'edge', id: event.target.id() });
    };
    const over = (event: EventObject) => {
      const node = event.target;
      node.addClass('hovered');
      const data = node.data();
      const position = event.renderedPosition || node.renderedPosition();
      setTooltip({
        x: position.x,
        y: position.y,
        title: node.isNode() ? `${data.label} · ${data.id}` : data.id,
        text: node.isNode()
          ? `${data.role === 'Cash-Out' ? 'Probable endpoint' : data.role} · Risk ${data.risk_score.toFixed(2)}`
          : data.kind === 'entity_link'
            ? `Shared identifier · ${data.complaint_ids.length} other cases · Not a transfer`
            : `${formatCurrency(data.amount)} · ${data.channel}`,
      });
    };
    const clear = (event: EventObject) => {
      event.target.removeClass('hovered');
      setTooltip(null);
    };
    const contextTap = (event: EventObject) => {
      event.originalEvent?.preventDefault();
      setTooltip(null);
      setContext({
        id: event.target.id(),
        x: event.renderedPosition.x,
        y: event.renderedPosition.y,
      });
    };
    const viewport = () => {
      cy.elements().removeClass('hovered');
      setTooltip(null);
      setContext(null);
      cy.nodes().style('font-size', 13 / cy.zoom());
    };
    cy.on('tap', tap);
    cy.on('mouseover', 'node, edge', over);
    cy.on('mouseout', 'node, edge', clear);
    cy.on('cxttap', 'node', contextTap);
    cy.on('pan zoom', viewport);
    let lastSize = '';
    const observer = new ResizeObserver(() => {
      if (cy.destroyed() || !host.current) return;
      const size = `${host.current.clientWidth}:${host.current.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      cy.resize();
      setLayoutRevision((revision) => revision + 1);
    });
    if (host.current) observer.observe(host.current);
    return () => {
      cy.off('tap', tap);
      cy.off('mouseover', 'node, edge', over);
      cy.off('mouseout', 'node, edge', clear);
      cy.off('cxttap', 'node', contextTap);
      cy.off('pan zoom', viewport);
      observer.disconnect();
    };
  }, [cy, onSelect]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    setTooltip(null);
    setContext(null);
    let options: LayoutOptions = {
      name: 'cose',
      animate: false,
      padding: 55,
      randomize: false,
      nodeRepulsion: 18000,
      idealEdgeLength: 150,
      componentSpacing: 100,
      nodeDimensionsIncludeLabels: true,
    };
    if (view === 'Route')
      options = {
        name: 'preset',
        positions: flowPositions(graph, cy.width(), cy.height(), trace?.start_account),
        padding: 55,
      };
    if (view === 'Cluster') {
      const banks = [...new Set(graph.nodes.map((n) => n.data.bank_name))].sort();
      const positions: Record<string, { x: number; y: number }> = {};
      banks.forEach((bank, index) => {
        const members = graph.nodes
          .filter((n) => n.data.bank_name === bank)
          .sort((a, b) => a.data.id.localeCompare(b.data.id));
        const columns = Math.ceil(Math.sqrt(banks.length));
        members.forEach((n, i) => {
          const angle = (2 * Math.PI * i) / members.length;
          positions[n.data.id] = {
            x: (index % columns) * 350 + Math.cos(angle) * (60 + members.length * 5),
            y: Math.floor(index / columns) * 350 + Math.sin(angle) * (60 + members.length * 5),
          };
        });
      });
      options = { name: 'preset', positions, padding: 65 };
    }
    const layout = (
      view === 'Route'
        ? cy
            .elements()
            .filter((element) => element.isNode() || element.data('kind') !== 'entity_link')
        : cy.elements()
    ).layout(options);
    layout.run();
    cy.edges().toggleClass(
      'compact-flow',
      view === 'Route' && cy.width() >= 640 && cy.height() < 600,
    );
    frameGraph(cy, true);
    cy.nodes().style('font-size', 13 / cy.zoom());
    return () => {
      if (!cy.destroyed()) layout.stop();
    };
  }, [cy, graph, view, trace, layoutRevision]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    applyStoryFrame(cy, story, trace);
  }, [cy, graph, story, trace]);
  useEffect(() => {
    if (!cy || cy.destroyed() || !story || !playback.playing) return;
    return animateStory(cy, story.current, playback.speed);
  }, [cy, graph, story, playback.playing, playback.speed]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    cy.elements().unselect();
    if (selection) cy.getElementById(selection.id).select();
  }, [cy, selection, graph]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    cy.edges('.dna-link').removeClass('dna-focused');
    if (focusedEntity)
      cy.edges('.dna-link')
        .filter((edge) => edge.data('entity_ids').includes(focusedEntity))
        .addClass('dna-focused');
  }, [cy, graph, focusedEntity]);
  return (
    <div
      className="graph-host"
      ref={host}
      onContextMenu={(e) => e.preventDefault()}
      data-story-step={story ? playback.step : 'overview'}
    >
      <CytoscapeComponent
        id="network-canvas"
        elements={elements}
        stylesheet={graphStyles}
        cy={receiveCore}
        style={{ width: '100%', height: '100%' }}
        minZoom={0.12}
        maxZoom={3}
        boxSelectionEnabled={false}
        layout={{ name: 'preset' }}
      />
      <StoryOverlay
        cy={cy}
        graph={graph}
        trace={trace}
        story={story}
        playback={playback}
        selection={selection}
      />
      {dna && !story && (
        <article className="dna-summary" aria-label="Fraud DNA summary">
          <div>
            <Dna size={16} />
            <strong>{dna.campaign?.campaign_name || 'No detected family'}</strong>
            <span>{percent(dna.signature_score)} match</span>
            <button aria-label="Hide DNA connections" onClick={onHideDNA}>
              <X size={12} />
            </button>
          </div>
          <small>Shared identifiers · not money transfers</small>
          {dna.link_graph.truncated && (
            <small>
              Showing {dna.link_graph.edges.length} of {dna.link_graph.total_link_count} source
              relations
            </small>
          )}
        </article>
      )}
      <div className="graph-controls">
        <button aria-label="Zoom in" onClick={() => cy?.zoom(cy.zoom() * 1.2)}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom out" onClick={() => cy?.zoom(cy.zoom() / 1.2)}>
          <Minus size={17} />
        </button>
        <button
          aria-label="Fit graph"
          title="Fit the full graph"
          onClick={() => cy && frameGraph(cy)}
        >
          <Maximize size={16} />
        </button>
        <button aria-label="Reset layout" onClick={() => setLayoutRevision((n) => n + 1)}>
          <RotateCcw size={16} />
        </button>
      </div>
      <span className="graph-navigation-hint">Drag to explore · Fit to see the full trail</span>
      {view === 'Cluster' && (
        <div className="cluster-caption">
          Grouped by bank · hover or inspect an account for its bank
        </div>
      )}
      {tooltip && (
        <div
          className="graph-tooltip"
          style={{
            left: Math.min(tooltip.x + 14, Math.max(0, (host.current?.clientWidth || 600) - 250)),
            top: Math.max(0, tooltip.y - 65),
          }}
        >
          <strong>{tooltip.title}</strong>
          <span>{tooltip.text}</span>
        </div>
      )}
      {context && (
        <div
          className="graph-context"
          style={{
            left: Math.min(context.x, (host.current?.clientWidth || 600) - 210),
            top: Math.min(context.y, (host.current?.clientHeight || 400) - 60),
          }}
        >
          <button
            onClick={() => {
              onExpand(context.id);
              setContext(null);
            }}
          >
            Expand neighborhood
          </button>
          <button aria-label="Dismiss context menu" onClick={() => setContext(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
