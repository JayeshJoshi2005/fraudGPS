import { useState } from 'react';
import {
  Dna,
  Fingerprint,
  Smartphone,
  Monitor,
  AtSign,
  Globe,
  Link2,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import type { GraphData, TraceResult } from '../../types';
import type { DNAReport } from '../../types/dna';
import { formatCurrency, formatMinutes } from '../../utils/formatters';
import { operatingWindow, percent } from '../../utils/dna';
import { ErrorState, Loading } from '../common/Status';

interface Props {
  report?: DNAReport;
  trace?: TraceResult;
  catalog?: GraphData;
  loading: boolean;
  error?: string;
  onAnalyze: () => void;
  onCase: (id: string) => void;
  onAccount: (id: string) => void;
  focusedEntity?: string;
  onEntity: (id?: string) => void;
}
export function DNAPanel({
  report,
  trace,
  catalog,
  loading,
  error,
  onAnalyze,
  onCase,
  onAccount,
  focusedEntity,
  onEntity,
}: Props) {
  const [allEntities, setAllEntities] = useState(false);
  const label = (id: string) =>
    catalog?.nodes.find((node) => node.data.id === id)?.data.label || id;
  const matches = [...(report?.entity_dna.entity_matches || [])].sort(
    (a, b) =>
      Number(b.shared_with_accounts.length > 0 && b.shared_with_complaints.length > 0) -
        Number(a.shared_with_accounts.length > 0 && a.shared_with_complaints.length > 0) ||
      b.shared_with_complaints.length - a.shared_with_complaints.length ||
      a.entity_id.localeCompare(b.entity_id),
  );
  const fingerprint = report?.behavioral_dna.fingerprint;
  return (
    <div className="dna-panel" role="tabpanel" id="dna-panel" aria-labelledby="dna-tab">
      <div className="dna-heading">
        <Dna size={18} />
        <div>
          <p className="eyebrow">CROSS-CASE INTELLIGENCE</p>
          <h2>Fraud DNA</h2>
        </div>
      </div>
      {loading ? (
        <div className="dna-status">
          <Loading>Comparing identifiers and patterns…</Loading>
          <p>Using the current trace filters across all complaints.</p>
        </div>
      ) : error ? (
        <ErrorState message={error} retry={onAnalyze} />
      ) : !report ? (
        <div className="dna-empty">
          <Fingerprint size={44} />
          <h3>Find the common thread.</h3>
          <p>Compare shared identifiers, observed behavior, and network structure across cases.</p>
          <button onClick={onAnalyze} disabled={!trace?.steps.length}>
            <Dna size={15} />
            Analyze Fraud DNA
          </button>
          {!trace?.steps.length && <small>Trace a case with matching transfers first.</small>}
        </div>
      ) : (
        <>
          <section className="dna-signature" aria-label="Fraud signature">
            <div
              className="signature-ring"
              role="img"
              aria-label={`Fraud signature ${percent(report.signature_score)}`}
              style={{
                background: `conic-gradient(#c084fc ${report.signature_score * 360}deg, #24314b 0deg)`,
              }}
            >
              <div>
                <strong>{percent(report.signature_score)}</strong>
                <span>SIGNATURE MATCH</span>
              </div>
            </div>
            <p>
              {report.best_match_complaint_id
                ? `Closest case: ${report.best_match_complaint_id}`
                : 'No comparable case found'}
            </p>
            <small>Matching strength · heuristic score</small>
          </section>
          <div className="dna-components">
            {(['entity', 'behavioral', 'network'] as const).map((component) => (
              <div key={component} title={report.component_formulas[component]}>
                <label>
                  {component}
                  <small>{Math.round(report.weights[component] * 100)}% weight</small>
                </label>
                <meter
                  min={0}
                  max={1}
                  value={report.component_scores[component]}
                  aria-label={`${component} similarity`}
                />
                <strong>{percent(report.component_scores[component])}</strong>
              </div>
            ))}
          </div>
          <article className="dna-family" aria-label="Detected campaign family">
            <span className="eyebrow">INFERRED CAMPAIGN FAMILY</span>
            <h3>{report.campaign?.campaign_name || 'No detected family'}</h3>
            {report.campaign ? (
              <>
                <p>
                  {report.campaign.case_count} cases · {formatCurrency(report.campaign.total_loss)}
                </p>
                <small>Sum of reported losses · each case counted once</small>
                <details>
                  <summary>Family membership</summary>
                  {report.campaign.complaint_ids.map((cid) => (
                    <span className="dna-case-id" key={cid}>
                      {cid}
                      {cid === report.complaint_id ? ' · current' : ''}
                    </span>
                  ))}
                </details>
              </>
            ) : (
              <p>No group meets both identifier and signature thresholds.</p>
            )}
          </article>
          <div className="dna-section-heading">
            <Link2 size={15} />
            <h3>Shared identifiers</h3>
            <span>{report.entity_dna.total_entity_overlaps}</span>
          </div>
          <p className="dna-caption">
            {report.entity_dna.unique_linked_complaints} other cases share identifiers with this
            trail.
          </p>
          {!matches.length && (
            <p className="dna-empty-note">No shared identifier records in this trace.</p>
          )}
          <div className="entity-matches">
            {(allEntities ? matches : matches.slice(0, 6)).map((match) => {
              const Icon =
                {
                  phone: Smartphone,
                  device_id: Monitor,
                  upi_id: AtSign,
                  email: AtSign,
                  ip_address: Globe,
                }[match.entity_type] || Fingerprint;
              const expanded = focusedEntity === match.entity_id;
              return (
                <article
                  key={match.entity_id}
                  data-entity-id={match.entity_id}
                  className={`entity-match ${expanded ? 'active' : ''}`}
                >
                  <button
                    className="entity-match-toggle"
                    aria-expanded={expanded}
                    onClick={() => onEntity(expanded ? undefined : match.entity_id)}
                  >
                    <Icon size={15} />
                    <span>
                      <strong>{match.masked_value}</strong>
                      <small>
                        {match.entity_type.replaceAll('_', ' ')} · {match.entity_id}
                      </small>
                      <small>
                        {match.shared_with_accounts.length} external accounts ·{' '}
                        {match.shared_with_complaints.length} other cases
                      </small>
                    </span>
                  </button>
                  {expanded && (
                    <div className="entity-evidence">
                      <p>Current trail accounts</p>
                      {match.matched_account_ids.map((id) => (
                        <button key={id} onClick={() => onAccount(id)}>
                          {label(id)}
                          <small>{id}</small>
                        </button>
                      ))}
                      <p>External peer accounts</p>
                      {match.shared_with_accounts.length ? (
                        match.shared_with_accounts.map((id) => (
                          <button key={id} onClick={() => onAccount(id)}>
                            {label(id)}
                            <small>{id}</small>
                          </button>
                        ))
                      ) : (
                        <small>
                          Links reuse accounts already in this trail. No self-edge is drawn.
                        </small>
                      )}
                      <p>Other source-linked cases</p>
                      <div className="entity-case-list">
                        {match.shared_with_complaints.map((cid) => (
                          <button key={cid} onClick={() => onCase(cid)}>
                            {cid}
                            <ArrowUpRight size={10} />
                          </button>
                        ))}
                      </div>
                      <small>
                        Purple lines highlight this identifier where external peers belong to other
                        cases.
                      </small>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {matches.length > 6 && (
            <button className="dna-more" onClick={() => setAllEntities((value) => !value)}>
              {allEntities ? 'Show fewer identifiers' : `Show all ${matches.length} identifiers`}
            </button>
          )}
          <div className="dna-section-heading">
            <Fingerprint size={15} />
            <h3>Similar cases</h3>
            <span>{report.similar_cases.length}</span>
          </div>
          <p className="dna-caption">
            Ranked by combined similarity. Pattern similarity alone does not establish a case link.
          </p>
          {!report.similar_cases.length && (
            <p className="dna-empty-note">No other comparable cases.</p>
          )}
          <div className="dna-similar-cases">
            {report.similar_cases.map((item) => (
              <button
                key={item.complaint_id}
                aria-label={`Investigate ${item.complaint_id}`}
                onClick={() => onCase(item.complaint_id)}
              >
                <span>
                  <strong>{item.complaint_id}</strong>
                  <small>
                    {formatCurrency(item.amount_lost)} · {item.scam_type}
                  </small>
                  <small>
                    {item.shared_entity_ids.length
                      ? `${item.shared_entity_ids.length} shared identifiers`
                      : 'Pattern similarity only'}
                  </small>
                </span>
                <span className="similarity-value">
                  {percent(item.similarity)}
                  <ArrowUpRight size={12} />
                </span>
              </button>
            ))}
          </div>
          {fingerprint && (
            <>
              <div className="dna-section-heading">
                <Layers size={15} />
                <h3>Behavioral signature</h3>
              </div>
              <dl className="dna-fingerprint">
                <dt>Avg transfer</dt>
                <dd>
                  {fingerprint.avg_transaction_amount === null
                    ? 'Not observed'
                    : formatCurrency(fingerprint.avg_transaction_amount)}
                </dd>
                <dt>Forwarding delay</dt>
                <dd>{formatMinutes(fingerprint.avg_time_to_forward_minutes)}</dd>
                <dt>Mean split</dt>
                <dd>
                  {fingerprint.split_ratio
                    ? `1 → ${Number(fingerprint.split_ratio.toFixed(1))}`
                    : 'No split observed'}
                </dd>
                <dt>Activity hours</dt>
                <dd>{operatingWindow(fingerprint.operating_hours)}</dd>
                <dt>Depth reached</dt>
                <dd>{fingerprint.num_hops} hops</dd>
                <dt>Observed dormancy</dt>
                <dd>
                  {fingerprint.dormancy_days === null
                    ? 'Not observed'
                    : `${Number(fingerprint.dormancy_days.toFixed(1))} days`}
                  <small>{fingerprint.dormancy_sample_accounts} accounts with prior baseline</small>
                </dd>
                <dt>Withdrawal method</dt>
                <dd>Unknown</dd>
              </dl>
              <p className="dna-caption">
                Amounts are source transfer averages; forwarding is weighted by attributed funds.
                Dormancy requires a prior observed gap and activation burst.
              </p>
            </>
          )}
          <details className="dna-method">
            <summary>Network structure and method</summary>
            <dl className="dna-fingerprint">
              {Object.entries(report.network_dna.topology_features).map(([key, value]) => (
                <div className="dna-feature-row" key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{typeof value === 'number' ? Number(value.toFixed(3)) : value}</dd>
                </div>
              ))}
            </dl>
            <p>{report.component_formulas.signature}</p>
            <p>{report.component_formulas.campaign}</p>
            <small>
              {report.method_version} · {report.compared_case_count} other cases compared
            </small>
          </details>
          <p className="dna-caption">
            Shared identifiers and inferred families support investigation. They do not prove a
            common operator or wrongdoing.
          </p>
        </>
      )}
    </div>
  );
}
