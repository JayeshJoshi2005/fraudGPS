import type { Core } from 'cytoscape';
import type { TraceResult } from '../../types';

export function animateTrail(cy: Core, trace?: TraceResult): () => void {
  if (!trace || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ids = [...new Set([trace.start_account, ...trace.steps.map((s) => s.to_account)])];
  const timers = ids.map((id, i) =>
    window.setTimeout(() => {
      if (!cy.destroyed()) {
        cy.nodes().removeClass('lit');
        cy.getElementById(id).addClass('lit');
      }
    }, i * 300),
  );
  let offset = 0;
  const flow = window.setInterval(() => {
    if (cy.destroyed()) return;
    cy.edges('.trail').style('line-dash-offset', --offset % 11);
    if (offset % 10 === 0) cy.nodes('[risk_score >= 0.9]').toggleClass('critical-pulse');
  }, 100);
  timers.push(
    window.setTimeout(() => {
      if (!cy.destroyed()) cy.nodes().removeClass('lit');
    }, ids.length * 300),
  );
  return () => {
    timers.forEach(clearTimeout);
    clearInterval(flow);
    if (!cy.destroyed()) {
      cy.nodes().removeClass('lit critical-pulse');
      cy.edges().removeStyle('line-dash-offset');
    }
  };
}
