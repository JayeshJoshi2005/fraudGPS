import type { StylesheetJson } from 'cytoscape';

export const riskColor = (score: number) =>
  score >= 0.7 ? '#fb7185' : score >= 0.5 ? '#fb923c' : score >= 0.3 ? '#facc15' : '#34d399';
export const graphStyles: StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': '#192333',
      'border-color': 'data(color)',
      'border-width': 3,
      width: 'data(size)',
      height: 'data(size)',
      label: 'data(label)',
      color: '#edf2fa',
      'font-size': 13,
      'font-family': 'Segoe UI, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'text-background-color': '#0d131e',
      'text-background-opacity': 0.95,
      'text-background-padding': '4px',
      'text-background-shape': 'roundrectangle',
    },
  },
  {
    selector: 'node[role = "Victim"]',
    style: {
      shape: 'diamond',
      'background-color': '#3b82f6',
      'border-color': '#93c5fd',
      'border-width': 3,
    },
  },
  {
    selector: 'node[role = "Cash-Out"]',
    style: { shape: 'round-rectangle', 'background-color': '#172033', 'border-width': 3 },
  },
  {
    selector: 'edge',
    style: {
      width: 'data(width)',
      'curve-style': 'bezier',
      'line-color': '#8c9db5',
      'target-arrow-color': '#8c9db5',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 1.15,
      opacity: 0.65,
      'control-point-step-size': 45,
    },
  },
  {
    selector: 'edge.suspicious',
    style: { 'line-color': '#8c9db5', 'target-arrow-color': '#8c9db5' },
  },
  {
    selector: 'edge.compact-flow[kind = "transaction"]',
    style: {
      'curve-style': 'unbundled-bezier',
      'control-point-distances': [40],
      'control-point-weights': [0.5],
    },
  },
  {
    selector: 'edge.trail',
    style: {
      'line-color': '#67bdf1',
      'target-arrow-color': '#67bdf1',
      opacity: 0.9,
      'line-style': 'solid',
    },
  },
  {
    selector: ':selected',
    style: {
      'border-color': '#ffffff',
      'border-width': 4,
      'overlay-color': '#ffffff',
      'overlay-opacity': 0.08,
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'line-color': '#ffffff',
      'target-arrow-color': '#ffffff',
      opacity: 1,
      label: 'data(amount_display)',
      color: '#ffffff',
      'font-size': 11,
      'text-background-color': '#111827',
      'text-background-opacity': 1,
      'text-background-padding': '5px',
    },
  },
  {
    selector: 'edge.dna-link',
    style: {
      'line-color': '#c084fc',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'line-style': 'dashed',
      'line-dash-pattern': [5, 5],
      opacity: 0.75,
      width: 2,
      label: '',
      color: '#c7a2e8',
      'font-size': 12,
      'text-rotation': 'autorotate',
      'text-background-color': '#171c35',
      'text-background-opacity': 0.9,
      'text-background-padding': '3px',
    },
  },
  {
    selector: 'edge.dna-link.dna-focused, edge.dna-link:selected, edge.dna-link.hovered',
    style: { 'line-color': '#e9b5ff', opacity: 1, width: 4, label: 'Shared identifier' },
  },
  { selector: 'node.hovered', style: { 'border-color': '#ffffff', 'border-width': 4 } },
  { selector: '.story-dim', style: { opacity: 0.15, 'text-opacity': 0.15 } },
  { selector: 'edge.dna-link.story-dim', style: { opacity: 0.15, 'text-opacity': 0.15 } },
  { selector: '.story-revealed', style: { opacity: 1, 'text-opacity': 1 } },
  {
    selector: 'node.story-revealed[role = "Cash-Out"]',
    style: { shape: 'ellipse', 'background-color': 'data(color)', 'border-color': 'data(color)' },
  },
  {
    selector: 'node.story-focus, node.story-cascade',
    style: {
      'border-width': 5,
      'border-color': '#bae6fd',
      'overlay-color': '#38bdf8',
      'overlay-opacity': 0.18,
      'overlay-padding': 9,
    },
  },
  {
    selector: 'edge.story-current',
    style: {
      'line-color': '#67e8f9',
      'target-arrow-color': '#67e8f9',
      'line-style': 'dashed',
      opacity: 1,
    },
  },
  {
    selector: 'edge.story-rapid',
    style: { 'line-color': '#fb923c', 'target-arrow-color': '#fb923c' },
  },
  {
    selector: 'node.story-terminal, node.story-revealed.story-terminal',
    style: {
      shape: 'round-rectangle',
      'background-color': '#101522',
      'border-color': '#fb7185',
      'border-width': 4,
    },
  },
  {
    selector: 'edge.story-terminal',
    style: { 'line-color': '#fb7185', 'target-arrow-color': '#fb7185' },
  },
];
