import {
  Clock3,
  GitFork,
  Layers,
  Network,
  Route,
  Timer,
  Wallet,
  MapPin,
  Files,
} from 'lucide-react';
import type { TraceResult } from '../../types';
import { formatCurrency, formatDuration, formatMinutes } from '../../utils/formatters';
import { AnimatedValue } from '../common/AnimatedValue';

export function TrailStats({ trace, compact = false }: { trace?: TraceResult; compact?: boolean }) {
  const splits = trace?.detections.filter((e) => e.type === 'split').length;
  const stats = trace?.statistics;
  const cells = compact
    ? [
        {
          icon: Wallet,
          label: 'SEEDED FUNDS',
          value: trace ? formatCurrency(trace.metrics.seed_amount) : '—',
        },
        { icon: Network, label: 'ACCOUNTS', value: trace?.metrics.account_count ?? '—' },
        { icon: Route, label: 'TRANSFERS', value: trace?.metrics.transaction_count ?? '—' },
        { icon: GitFork, label: 'SPLIT EVENTS', value: splits ?? '—' },
      ]
    : [
        {
          icon: Wallet,
          label: 'FUNDS TRACED',
          value: trace ? formatCurrency(trace.metrics.seed_amount) : '—',
          tip: 'Seed funds counted once. Repeated hop volume is excluded.',
        },
        { icon: Network, label: 'TRAIL ACCOUNTS', value: trace?.metrics.account_count ?? '—' },
        { icon: GitFork, label: 'SPLIT EVENTS', value: splits ?? '—' },
        {
          icon: Layers,
          label: 'DEEPEST LAYER',
          value: trace ? `${trace.metrics.max_depth_reached} hops` : '—',
          tip: 'Maximum attributed depth; the initial transfer counts as hop 1.',
        },
        {
          icon: MapPin,
          label: 'PROBABLE ENDPOINTS',
          value: stats?.probable_endpoint_account_ids.length ?? '—',
          tip: 'Distinct accounts; no significant forwarding in the observed window. Withdrawal method unknown.',
        },
        {
          icon: Timer,
          label: 'FASTEST FORWARD',
          value: stats ? formatMinutes(stats.fastest_forward_minutes) : '—',
          tip: 'Minimum observed positive delay between a tracked receipt and its attributed outgoing transfer.',
        },
        {
          icon: Clock3,
          label: 'TRAIL DURATION',
          value: stats ? formatDuration(stats.transfer_duration_seconds) : '—',
          tip: 'First to last observed transfer. Endpoint observation windows are excluded.',
        },
        {
          icon: Files,
          label: 'OTHER COMPLAINTS',
          value: stats?.other_linked_complaint_ids.length ?? '—',
          tip: 'Other complaints linked through accounts in this trail; excludes the selected complaint. No DNA similarity is implied.',
        },
      ];
  return (
    <section
      className={compact ? 'trail-stats' : 'story-stats'}
      aria-label={compact ? 'Trace overview' : 'Trail statistics'}
    >
      {!compact && (
        <div className="section-title">
          <Route size={15} />
          <h3>Trail statistics</h3>
        </div>
      )}
      <div className={compact ? 'overview-grid' : 'story-stats-grid'}>
        {cells.map(({ icon: Icon, label, value, tip }) => (
          <div key={label} title={tip}>
            <Icon size={16} />
            <span>
              {label}
              <strong>
                {trace && ['SEEDED FUNDS', 'FUNDS TRACED'].includes(label) ? (
                  <AnimatedValue value={trace.metrics.seed_amount} money />
                ) : (
                  value
                )}
              </strong>
            </span>
          </div>
        ))}
      </div>
      {!compact && (
        <p className="stats-note">
          {trace?.metrics.transaction_count ?? 0} distinct transfers · Seed funds counted once.
          <br />
          Account links use source records and default trails.
          {trace?.balances.some((balance) => balance.reason === 'max_depth') && (
            <>
              <br />
              Depth limit reached. Increase depth to inspect later transfers.
            </>
          )}
        </p>
      )}
    </section>
  );
}
