import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { GraphNode, RiskResult } from '../../types';
import { errorMessage, fetchTopRisks, sameDataset } from '../../utils/api';
import { ErrorState, Loading } from '../common/Status';

export function AlertPanel({
  version,
  nodes,
  onAccount,
  onClose,
}: {
  version: string;
  nodes: GraphNode[];
  onAccount: (id: string) => void;
  onClose: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ loading: boolean; items?: RiskResult[]; error?: string }>({
    loading: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    fetchTopRisks(200, controller.signal)
      .then((items) => {
        sameDataset(version, ...items.map((item) => item.dataset_version));
        const known = new Set(nodes.map((node) => node.id));
        if (
          items.some(
            (item) =>
              !known.has(item.account_id) ||
              !Number.isFinite(item.total_score) ||
              item.total_score < 0 ||
              item.total_score > 1,
          )
        )
          throw new Error('Alert evidence does not match the workspace. Reload and retry.');
        if (!controller.signal.aborted)
          setState({
            loading: false,
            items: items
              .filter((item) => item.total_score >= 0.5)
              .sort(
                (a, b) => b.total_score - a.total_score || a.account_id.localeCompare(b.account_id),
              ),
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ loading: false, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [version, attempt, nodes]);
  return (
    <section className="alert-panel" role="dialog" aria-label="High-risk accounts">
      <div className="alert-panel-heading">
        <ShieldAlert size={17} />
        <h2>High-risk accounts</h2>
        <button aria-label="Close alerts" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <p className="alert-scope">Across the dataset · risk ≥0.50 · highest first</p>
      {state.loading ? (
        <Loading>Loading account alerts…</Loading>
      ) : state.error ? (
        <ErrorState message={state.error} retry={() => setAttempt((value) => value + 1)} />
      ) : !state.items?.length ? (
        <p className="alert-empty">No accounts meet the high-risk threshold.</p>
      ) : (
        <div className="alert-list">
          {state.items.map((item) => {
            const node = nodes.find((node) => node.id === item.account_id)!;
            return (
              <article
                key={item.account_id}
                className="account-alert"
                data-account-id={item.account_id}
              >
                <div>
                  <strong>{node.label}</strong>
                  <span className={`badge ${item.risk_level.toLowerCase()}`}>
                    {item.total_score.toFixed(2)}
                  </span>
                </div>
                <p>
                  {item.account_id} · {item.role}
                </p>
                <p
                  className="alert-reason"
                  title={item.reasons[0] || 'Review the measured risk evidence.'}
                >
                  {item.reasons[0] || 'Review the measured risk evidence.'}
                </p>
                <button
                  onClick={() => {
                    onAccount(item.account_id);
                    onClose();
                  }}
                  aria-label={`Investigate alert ${item.account_id}`}
                >
                  Investigate
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
