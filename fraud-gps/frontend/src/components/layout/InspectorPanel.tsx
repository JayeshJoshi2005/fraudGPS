import { Expand, Fingerprint, ScanSearch, X } from 'lucide-react';
import type { GraphData, Selection, TraceResult } from '../../types';
import { useRisk } from '../../hooks/useRisk';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { Badge, ErrorState, EvidenceSkeleton } from '../common/Status';
import { RiskCard } from '../cards/RiskCard';

interface Props {
  selection: Selection;
  graph?: GraphData;
  catalog?: GraphData;
  trace?: TraceResult;
  onClose: () => void;
  onExpand: (id: string) => void;
  expanding: boolean;
}
export function InspectorPanel({
  selection,
  graph,
  catalog,
  trace,
  onClose,
  onExpand,
  expanding,
}: Props) {
  const id = selection?.kind === 'node' ? selection.id : undefined;
  const detail = useRisk(id, catalog?.dataset_version || '');
  const node =
    graph?.nodes.find((n) => n.data.id === id)?.data ||
    catalog?.nodes.find((n) => n.data.id === id)?.data;
  const edge =
    selection?.kind === 'edge'
      ? graph?.edges.find((e) => e.data.id === selection.id)?.data
      : undefined;
  const label = (accountId: string) =>
    catalog?.nodes.find((n) => n.data.id === accountId)?.data.label || accountId;
  return (
    <section
      className="account-inspector"
      role="region"
      id="account-panel"
      aria-label="Account inspector"
    >
      <div className="panel-heading">
        <ScanSearch size={17} />
        <h2>Evidence inspector</h2>
        {selection && (
          <button className="icon-button" aria-label="Close inspector" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
      {!selection ? (
        <div className="inspector-empty">
          <div className="empty-icon">
            <Fingerprint size={42} strokeWidth={1} />
          </div>
          <h3>Follow the evidence.</h3>
          <p>
            Click an account to inspect its risk,
            <br />
            or a transfer to see the money trail.
          </p>
          <span className="eyebrow">EVERY CONNECTION HAS A STORY</span>
        </div>
      ) : (
        <div className="inspector-body">
          {edge?.kind === 'entity_link' ? (
            <>
              <p className="eyebrow">SHARED IDENTIFIER LINK</p>
              <h3 className="mono">{edge.id}</h3>
              <p className="filter-note">
                These accounts share source identifiers. This line does not represent a money
                transfer.
              </p>
              <dl className="details-grid">
                <dt>Current account</dt>
                <dd>
                  {label(edge.source)}
                  <small>{edge.source}</small>
                </dd>
                <dt>Peer account</dt>
                <dd>
                  {label(edge.target)}
                  <small>{edge.target}</small>
                </dd>
                <dt>Entity evidence</dt>
                <dd>{edge.entity_ids.join(', ')}</dd>
                <dt>Other complaints</dt>
                <dd>{edge.complaint_ids.join(', ')}</dd>
              </dl>
            </>
          ) : edge ? (
            <>
              <p className="eyebrow">TRANSFER DETAILS</p>
              <h3 className="mono">{edge.id}</h3>
              <div className="transfer-amount">{formatCurrency(edge.amount)}</div>
              <Badge text={edge.channel} />
              <dl className="details-grid">
                <dt>From</dt>
                <dd>
                  {label(edge.source)}
                  <small>{edge.source}</small>
                </dd>
                <dt>To</dt>
                <dd>
                  {label(edge.target)}
                  <small>{edge.target}</small>
                </dd>
                <dt>Date</dt>
                <dd>{formatDate(edge.timestamp)}</dd>
                <dt>Time</dt>
                <dd>{formatTime(edge.timestamp)} IST</dd>
                <dt>Trace attribution</dt>
                <dd>
                  {edge.attributed_amount !== null
                    ? formatCurrency(edge.attributed_amount)
                    : 'Context transfer'}
                </dd>
              </dl>
              <p className="filter-note">
                Source transfer amount and attributed funds are distinct. FIFO attribution is an
                investigation hypothesis.
              </p>
              {trace?.steps
                .find((s) => s.tx_id === edge.id)
                ?.allocations.map((a, i) => (
                  <div className="evidence" key={i}>
                    <strong>
                      {formatCurrency(a.amount)} · {a.depth} hops
                    </strong>
                    <p className="mono">{a.path.join(' → ')}</p>
                  </div>
                ))}
            </>
          ) : (
            <>
              <div className="account-heading">
                <div>
                  <p className="eyebrow">ACCOUNT PROFILE</p>
                  <h3>{node?.label || 'Account'}</h3>
                  <p className="mono muted">{id}</p>
                </div>
                <Badge
                  text={node?.role === 'Cash-Out' ? 'Probable endpoint' : node?.role || 'Account'}
                />
              </div>
              {detail.loading && <EvidenceSkeleton>Loading account evidence…</EvidenceSkeleton>}
              {detail.error && (
                <ErrorState
                  message={`Unable to load risk data. ${detail.error}`}
                  retry={detail.retry}
                />
              )}
              {detail.account && detail.risk && (
                <>
                  <dl className="details-grid">
                    <dt>Holder</dt>
                    <dd>{detail.account.account.holder_name}</dd>
                    <dt>Bank</dt>
                    <dd>{detail.account.account.bank_name}</dd>
                    <dt>Type</dt>
                    <dd>{detail.account.account.account_type}</dd>
                    <dt>KYC</dt>
                    <dd>{detail.account.account.kyc_status}</dd>
                    <dt>Location</dt>
                    <dd>{detail.account.account.location}</dd>
                    <dt>Account age</dt>
                    <dd>
                      {detail.account.account.account_age_days} days
                      <small>as of {formatDate(detail.account.account.age_as_of)}</small>
                    </dd>
                  </dl>
                  <RiskCard risk={detail.risk} />
                  <h4 className="eyebrow">OBSERVED ACTIVITY · ALL RECORDS</h4>
                  <dl className="details-grid activity">
                    <dt>Total inflow</dt>
                    <dd>{formatCurrency(detail.account.total_inflow)}</dd>
                    <dt>Total outflow</dt>
                    <dd>{formatCurrency(detail.account.total_outflow)}</dd>
                    <dt>Unique senders</dt>
                    <dd>{detail.account.distinct_senders}</dd>
                    <dt>Unique receivers</dt>
                    <dd>{detail.account.distinct_recipients}</dd>
                    <dt title="Amount-weighted observed FIFO receipt-to-forward delay">
                      Avg. forwarding time
                    </dt>
                    <dd>
                      {detail.account.average_forward_minutes === null
                        ? 'Not observed'
                        : `${detail.account.average_forward_minutes.toFixed(1)} min`}
                    </dd>
                    <dt>Linked complaints</dt>
                    <dd>{detail.account.linked_complaint_ids.length}</dd>
                  </dl>
                  <button
                    className="expand-button"
                    onClick={() => id && onExpand(id)}
                    disabled={expanding}
                  >
                    <Expand size={15} />
                    {expanding ? 'Expanding…' : 'Expand neighborhood'}
                  </button>
                  <details className="evidence-details">
                    <summary>Risk evidence & source references</summary>
                    {detail.risk.evidence.map((e) => (
                      <div className="evidence" key={e.code}>
                        <strong>{e.code}</strong>
                        <p>{e.description}</p>
                        <p className="mono source-ids">
                          {[...e.transaction_ids, ...e.entity_ids, ...e.complaint_ids].join(
                            ' · ',
                          ) || 'No matching source records'}
                        </p>
                      </div>
                    ))}
                  </details>
                  {node?.role !== detail.risk.role && (
                    <p className="filter-note">
                      This view’s role uses the selected trail. Dataset-wide role:{' '}
                      {detail.risk.role}.
                    </p>
                  )}
                  <p className="filter-note">
                    Scores are heuristics, not proof of wrongdoing. An endpoint does not establish a
                    withdrawal method.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
