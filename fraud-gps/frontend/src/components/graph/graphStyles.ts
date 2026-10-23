import type { StylesheetJson } from 'cytoscape';

export const riskColor = (score: number) =>
  score >= 0.9
    ? '#be123c'
    : score >= 0.7
      ? '#fb7185'
      : score >= 0.5
        ? '#fb923c'
        : score >= 0.3
          ? '#facc15'
          : '#34d399';
export const graphStyles: StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      'border-color': 'data(color)',
      'border-width': 2,
      width: 'data(size)',
      height: 'data(size)',
      label: 'data(label)',
      color: '#b9c7dd',
      'font-size': 10,
      'font-family': 'Segoe UI, sans-serif',
      'text-valign': 'bottom',
      'text-margin-y': 9,
      'text-background-color': '#0b1322',
      'text-background-opacity': 0.8,
      'text-background-padding': '3px',
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
      'line-color': '#53617a',
      'target-arrow-color': '#53617a',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      opacity: 0.35,
      'control-point-step-size': 30,
    },
  },
  {
    selector: 'edge.suspicious',
    style: { 'line-color': '#fb7185', 'target-arrow-color': '#fb7185' },
  },
  {
    selector: 'edge.trail',
    style: {
      'line-color': '#38bdf8',
      'target-arrow-color': '#38bdf8',
      opacity: 0.85,
      'line-style': 'dashed',
      'line-dash-pattern': [7, 4],
    },
  },
  {
    selector: 'node.lit',
    style: {
      'border-color': '#e0f2fe',
      'border-width': 6,
      'overlay-color': '#38bdf8',
      'overlay-opacity': 0.18,
      'overlay-padding': 9,
    },
  },
  {
    selector: 'node.critical-pulse',
    style: { 'overlay-color': '#fb7185', 'overlay-opacity': 0.13, 'overlay-padding': 8 },
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
];
