import type { Core } from 'cytoscape';
import type { TraceResult } from '../../types';
import type { TimelineEvent } from '../../types';
import type { StoryFrame } from '../../utils/playback';

const storyClasses =
  'story-dim story-revealed story-focus story-current story-rapid story-terminal story-cascade';

export function applyStoryFrame(cy: Core, frame: StoryFrame | undefined, trace?: TraceResult) {
  if (cy.destroyed()) return;
  cy.batch(() => {
    cy.elements().removeClass(storyClasses).removeStyle('line-dash-offset');
    if (!frame) return;
    cy.elements().addClass('story-dim');
    for (const id of frame.nodes)
      cy.getElementById(id).removeClass('story-dim').addClass('story-revealed');
    for (const id of frame.edges)
      cy.getElementById(id).removeClass('story-dim').addClass('story-revealed');
    for (const id of frame.rapidEdges) cy.getElementById(id).addClass('story-rapid');
    for (const id of frame.terminalEdges) cy.getElementById(id).addClass('story-terminal');
    for (const id of frame.terminalNodes) cy.getElementById(id).addClass('story-terminal');
    const event = frame.current;
    if (!event && trace) cy.getElementById(trace.start_account).addClass('story-focus');
    if (event) {
      const focus =
        event.type === 'transfer' ? event.account_ids.slice(1) : event.account_ids.slice(0, 1);
      focus.forEach((id) => cy.getElementById(id).addClass('story-focus'));
      const edges =
        event.type === 'split' ? event.outputs.map((o) => o.transaction_id) : event.transaction_ids;
      edges.forEach((id) => cy.getElementById(id).addClass('story-current'));
    }
  });
}

export function animateStory(
  cy: Core,
  event: TimelineEvent | undefined,
  speed: number,
): () => void {
  if (!event || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let active = true;
  let offset = Number(cy.edges('.story-current').first().style('line-dash-offset')) || 0;
  const flow = window.setInterval(() => {
    if (!cy.destroyed()) cy.edges('.story-current').style('line-dash-offset', --offset % 11);
  }, 60 / speed);
  const timers: number[] = [];
  const animated =
    event.type === 'transfer'
      ? event.account_ids.slice(1)
      : event.type === 'split'
        ? event.account_ids
        : [];
  animated.forEach((id) => {
    const node = cy.getElementById(id);
    if (node.empty()) return;
    if (event.type === 'transfer')
      node.style('opacity', 0.15).animate({ style: { opacity: 1 } }, { duration: 250 / speed });
    else {
      const size = node.data('size');
      node.animate(
        { style: { width: size * 1.18, height: size * 1.18 } },
        {
          duration: 150 / speed,
          complete: () => {
            if (active && !cy.destroyed())
              node.animate({ style: { width: size, height: size } }, { duration: 150 / speed });
          },
        },
      );
    }
  });
  if (event.type === 'layering')
    event.account_ids.forEach((id, index) => {
      timers.push(
        window.setTimeout(
          () => {
            if (!cy.destroyed()) {
              cy.nodes().removeClass('story-cascade');
              cy.getElementById(id).addClass('story-cascade');
            }
          },
          (index * 150) / speed,
        ),
      );
    });
  return () => {
    active = false;
    clearInterval(flow);
    timers.forEach(clearTimeout);
    if (!cy.destroyed()) {
      cy.nodes().removeClass('story-cascade');
      animated.forEach((id) =>
        cy.getElementById(id).stop(true, false).removeStyle('opacity width height'),
      );
    }
  };
}
