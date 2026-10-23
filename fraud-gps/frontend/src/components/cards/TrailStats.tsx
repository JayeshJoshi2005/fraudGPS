import { GitFork, Network, Route, Wallet } from 'lucide-react';
import type { TraceResult } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export function TrailStats({ trace }: { trace?: TraceResult }) {
  return (
    <div className="trail-stats" aria-label="Trail statistics">
      <div>
        <Wallet size={16} />
        <span>
          SEEDED FUNDS<strong>{trace ? formatCurrency(trace.metrics.seed_amount) : '—'}</strong>
        </span>
      </div>
      <div>
        <Network size={16} />
        <span>
          ACCOUNTS<strong>{trace?.metrics.account_count ?? '—'}</strong>
        </span>
      </div>
      <div>
        <Route size={16} />
        <span>
          TRANSFERS<strong>{trace?.metrics.transaction_count ?? '—'}</strong>
        </span>
      </div>
      <div>
        <GitFork size={16} />
        <span>
          SPLIT EVENTS
          <strong>{trace ? trace.detections.filter((e) => e.type === 'split').length : '—'}</strong>
        </span>
      </div>
    </div>
  );
}
