import type { GraphNode, TimelineEvent } from '../types';
import type { CaseSummary, ToastMessage } from '../types/reports';
import { formatCurrency } from './formatters';
import { eventTitle } from './playback';

export function eventNotifications(
  event: TimelineEvent,
  nodes: GraphNode[],
  summary: CaseSummary | undefined,
  seen: Set<string>,
) {
  const result: ToastMessage[] = [];
  const add = (id: string, title: string, detail: string, tone: ToastMessage['tone']) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ id, kind: 'story', title, detail, tone });
  };
  for (const id of event.account_ids) {
    const node = nodes.find((n) => n.id === id);
    if (node && node.role !== 'Victim' && node.risk_score >= 0.5)
      add(
        `risk:${id}`,
        'High-risk account found',
        `${node.label} (${id}) · Dataset-wide risk ${node.risk_score.toFixed(2)}`,
        'danger',
      );
    const match = summary?.flagged_accounts.find((n) => n.account_id === id);
    if (match?.other_complaint_ids.length)
      add(
        `cases:${id}`,
        'Multi-case account match',
        `${match.label} is linked to ${match.other_complaint_ids.length} other complaints through account evidence.`,
        'info',
      );
  }
  if (event.type === 'split')
    add(
      event.event_id,
      'Suspicious split detected',
      `${formatCurrency(event.amount)} split into ${event.metrics.destination_count} accounts.`,
      'warning',
    );
  else if (event.type === 'terminal')
    add(
      event.event_id,
      'Probable endpoint reached',
      `${formatCurrency(event.amount)} · No significant forwarding in the observed window. Withdrawal method unknown.`,
      'warning',
    );
  else if (['rapid_forward', 'layering', 'merge'].includes(event.type))
    add(event.event_id, eventTitle(event.type), event.description, 'info');
  return result;
}
