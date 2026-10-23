import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { Core, EventObject, LayoutOptions } from 'cytoscape';
import { Maximize, Minus, Plus, RotateCcw } from 'lucide-react';
import type { GraphData, Selection, TraceResult, ViewMode } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { animateTrail } from './graphAnimations';
import { graphStyles, riskColor } from './graphStyles';

interface Props {
  graph: GraphData;
  trace?: TraceResult;
  view: ViewMode;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onExpand: (id: string) => void;
}
export function GraphCanvas({ graph, trace, view, selection, onSelect, onExpand }: Props) {
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
        data: { ...n.data, color: riskColor(n.data.risk_score), size: 30 + n.data.risk_score * 34 },
      })),
      ...graph.edges.map((e) => ({
        data: {
          ...e.data,
          width: Math.max(1, Math.min(8, Math.log10(Math.max(1, Number(e.data.amount))) - 1)),
        },
        classes: `${trail.has(e.data.id) ? 'trail' : ''} ${risky.has(e.data.source) || risky.has(e.data.target) ? 'suspicious' : ''}`,
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
      const data = node.data();
      const position = event.renderedPosition || node.renderedPosition();
      setTooltip({
        x: position.x,
        y: position.y,
        title: node.isNode() ? `${data.label} · ${data.id}` : data.id,
        text: node.isNode()
          ? `${data.role === 'Cash-Out' ? 'Probable endpoint' : data.role} · Risk ${data.risk_score.toFixed(2)}`
          : `${formatCurrency(data.amount)} · ${data.channel}`,
      });
    };
    const clear = () => setTooltip(null);
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
      setTooltip(null);
      setContext(null);
      cy.nodes().style('font-size', Math.max(10, 10 / cy.zoom()));
    };
    cy.on('tap', tap);
    cy.on('mouseover', 'node, edge', over);
    cy.on('mouseout', 'node, edge', clear);
    cy.on('cxttap', 'node', contextTap);
    cy.on('pan zoom', viewport);
    const observer = new ResizeObserver(() => cy.resize());
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
      padding: 65,
      randomize: true,
      nodeRepulsion: 4500,
      idealEdgeLength: 100,
      componentSpacing: 100,
    };
    if (view === 'Route')
      options = {
        name: 'breadthfirst',
        directed: true,
        padding: 60,
        spacingFactor: 1.3,
        circle: false,
        grid: true,
        roots: trace ? [trace.start_account] : undefined,
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
    const layout = cy.layout(options);
    layout.run();
    cy.nodes().style('font-size', Math.max(10, 10 / cy.zoom()));
    const stopAnimation = animateTrail(cy, trace);
    return () => {
      stopAnimation();
      if (!cy.destroyed()) layout.stop();
    };
  }, [cy, graph, view, trace, layoutRevision]);
  useEffect(() => {
    if (!cy || cy.destroyed()) return;
    cy.elements().unselect();
    if (selection) cy.getElementById(selection.id).select();
  }, [cy, selection, graph]);
  return (
    <div className="graph-host" ref={host} onContextMenu={(e) => e.preventDefault()}>
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
      <div className="graph-controls">
        <button aria-label="Zoom in" onClick={() => cy?.zoom(cy.zoom() * 1.2)}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom out" onClick={() => cy?.zoom(cy.zoom() / 1.2)}>
          <Minus size={17} />
        </button>
        <button aria-label="Fit graph" onClick={() => cy?.fit(undefined, 60)}>
          <Maximize size={16} />
        </button>
        <button aria-label="Reset layout" onClick={() => setLayoutRevision((n) => n + 1)}>
          <RotateCcw size={16} />
        </button>
      </div>
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
