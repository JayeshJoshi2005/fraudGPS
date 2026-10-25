import { FileDown, FileText, RotateCcw } from 'lucide-react';
import type { TraceResult } from '../../types';
import type { CaseSummary } from '../../types/reports';
import { formatCurrency } from '../../utils/formatters';
import { ErrorState, Loading } from '../common/Status';

interface Props {
  trace?: TraceResult;
  data?: CaseSummary;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onAccount: (id: string) => void;
  onCase: (id: string) => void;
  reviewed: ReadonlySet<string>;
  onReview: (id: string) => void;
  onResetReviews: () => void;
  downloading: boolean;
  onDownload: () => void;
}
export function CaseSummaryPanel(p: Props) {
  return (
    <section
      className="case-summary-panel"
      role="tabpanel"
      id="summary-panel"
      aria-labelledby="summary-tab"
    >
      <div className="summary-heading">
        <FileText size={19} />
        <div>
          <p className="eyebrow">INVESTIGATION NOTE</p>
          <h2>Case summary</h2>
        </div>
      </div>
      {!p.trace ? (
        <p className="summary-empty">
          Trace a complaint to build its investigation note and recommended actions.
        </p>
      ) : p.loading ? (
        <Loading>Preparing the case summary…</Loading>
      ) : p.error ? (
        <ErrorState message={p.error} retry={p.onRetry} />
      ) : (
        p.data && (
          <>
            <p className="summary-case-id">
              {p.data.complaint.complaint_id} · {p.data.complaint.scam_type}
            </p>
            <article className="summary-narrative" aria-label="Investigation narrative">
              {p.data.narrative}
            </article>
            <div className="summary-totals">
              <span>
                Seeded funds<strong>{formatCurrency(p.data.trace.metrics.seed_amount)}</strong>
              </span>
              <span>
                Flagged accounts<strong>{p.data.flagged_accounts.length}</strong>
              </span>
            </div>
            <details className="summary-evidence">
              <summary>
                Narrative evidence · {p.data.narrative_transaction_ids.length} transfers
              </summary>
              <p>{p.data.narrative_transaction_ids.join(', ') || 'No matching transfers.'}</p>
            </details>
            <div className="summary-section-heading">
              <h3>Recommended actions</h3>
              <span>{p.reviewed.size} reviewed</span>
              <button
                aria-label="Reset reviewed actions"
                title="Reset reviewed actions"
                disabled={!p.reviewed.size}
                onClick={p.onResetReviews}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <p className="summary-note">
              Check off actions you have reviewed in this session. No request is sent.
            </p>
            <div className="recommended-actions" aria-label="Recommended review actions">
              {!p.data.recommendations.length && (
                <p className="summary-empty">
                  No actions meet the evidence thresholds for these trace settings.
                </p>
              )}
              {p.data.recommendations.map((action) => (
                <article
                  key={action.action_id}
                  className={`recommended-action ${p.reviewed.has(action.action_id) ? 'reviewed' : ''}`}
                  data-action-id={action.action_id}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={p.reviewed.has(action.action_id)}
                      onChange={() => p.onReview(action.action_id)}
                    />
                    <strong>{action.title}</strong>
                  </label>
                  <span className={`badge ${action.priority.toLowerCase()}`}>
                    {action.priority}
                  </span>
                  <p>{action.rationale}</p>
                  <details>
                    <summary>Supporting evidence</summary>
                    {action.account_ids.map((id) => (
                      <button key={id} onClick={() => p.onAccount(id)} aria-label={`Inspect ${id}`}>
                        {id}
                      </button>
                    ))}
                    {action.kind === 'link_case' &&
                      action.complaint_ids.map((id) => (
                        <button
                          key={id}
                          onClick={() => p.onCase(id)}
                          aria-label={`Investigate ${id}`}
                        >
                          Investigate {id}
                        </button>
                      ))}
                    <p>
                      {[
                        ...action.transaction_ids,
                        ...action.entity_ids,
                        ...action.complaint_ids,
                      ].join(', ')}
                    </p>
                  </details>
                </article>
              ))}
            </div>
            <details className="summary-evidence">
              <summary>Analysis scope and limitations</summary>
              {p.data.limitations.map((value) => (
                <p key={value}>{value}</p>
              ))}
            </details>
            <button className="summary-download" disabled={p.downloading} onClick={p.onDownload}>
              <FileDown size={16} />
              {p.downloading ? 'Generating forensic report…' : 'Download investigation PDF'}
            </button>
          </>
        )
      )}
    </section>
  );
}
