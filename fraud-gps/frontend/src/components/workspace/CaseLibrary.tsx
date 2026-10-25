import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FolderOpen,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import type { InvestigationWorkspace } from '../../hooks/useInvestigationWorkspace';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ErrorState, Loading } from '../common/Status';
import { AnimatedValue } from '../common/AnimatedValue';

export function CaseLibrary({ model: m }: { model: InvestigationWorkspace }) {
  const [query, setQuery] = useState('');
  const [scam, setScam] = useState('all');
  const totals = useMemo(() => {
    let paise = 0n;
    for (const record of m.complaints) {
      const [whole, fraction = ''] = record.amount_lost.split('.');
      paise += BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    }
    return `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`;
  }, [m.complaints]);
  const cases = m.complaints.filter(
    (record) =>
      (scam === 'all' || record.scam_type === scam) &&
      `${record.complaint_id} ${record.victim_name} ${record.scam_type} ${record.victim_bank}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section
      className="case-library module-page"
      id="cases-panel"
      role="tabpanel"
      aria-labelledby="cases-tab"
    >
      <header className="module-heading">
        <div>
          <p className="eyebrow">YOUR INVESTIGATION DESK</p>
          <h1>One case. A clearer picture.</h1>
          <p>Start with a complaint. Follow the money. Connect the evidence.</p>
        </div>
        <span className="workspace-tag">
          <i />
          Synthetic workspace
        </span>
      </header>
      {m.workspace.loading ? (
        <Loading>Connecting to the investigation API…</Loading>
      ) : m.workspace.error ? (
        <ErrorState message={m.workspace.error} retry={m.workspace.retry} />
      ) : (
        <>
          <div className="library-metrics">
            <article>
              <FolderOpen size={20} />
              <span>
                Complaints<strong>{m.complaints.length}</strong>
              </span>
              <small>Available to investigate</small>
            </article>
            <article>
              <Wallet size={20} />
              <span>
                Reported losses<strong>{formatCurrency(totals)}</strong>
              </span>
              <small>Across source complaints</small>
            </article>
            <article>
              <ShieldAlert size={20} />
              <span>
                High-risk accounts
                <strong>{m.catalogNodes.filter((node) => node.risk_score >= 0.5).length}</strong>
              </span>
              <small>Dataset-wide · risk ≥ 0.50</small>
            </article>
          </div>
          <div className="case-library-content">
            <section className="case-directory">
              <div className="directory-heading">
                <div>
                  <h2>Case files</h2>
                  <p>Select a complaint to open its workspace.</p>
                </div>
                <span>{cases.length} records</span>
              </div>
              <div className="directory-filters">
                <label>
                  <Search size={16} />
                  <input
                    aria-label="Filter case files"
                    placeholder="Find a case, name, or bank"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter cases by scam type"
                  value={scam}
                  onChange={(event) => setScam(event.target.value)}
                >
                  <option value="all">All scam types</option>
                  {[...new Set(m.complaints.map((record) => record.scam_type))]
                    .sort()
                    .map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                </select>
              </div>
              <div className="case-file-list" aria-label="Complaint files">
                {cases.map((record) => (
                  <button
                    className={`case-file ${record.complaint_id === m.caseId ? 'selected' : ''}`}
                    key={record.complaint_id}
                    onClick={() => m.changeCase(record.complaint_id)}
                    aria-label={`Open case ${record.complaint_id}`}
                  >
                    <span className="case-file-icon">
                      <FolderOpen size={19} />
                    </span>
                    <span className="case-file-person">
                      <strong>{record.victim_name}</strong>
                      <small>
                        {record.complaint_id} · {record.victim_bank}
                      </small>
                    </span>
                    <span className="case-file-type">
                      {record.scam_type}
                      <small>{formatDate(record.complaint_date)}</small>
                    </span>
                    <span className="case-file-amount">
                      {formatCurrency(record.amount_lost)}
                      <small>{record.status}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
                {!cases.length && (
                  <div className="directory-empty">
                    <Search size={28} />
                    <h3>No matching case files</h3>
                    <p>Try another name, bank, or scam type.</p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setScam('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </section>
            <aside className="case-start" aria-label="Selected complaint">
              <span className="eyebrow">SELECTED CASE</span>
              <FolderOpen className="case-start-icon" size={35} />
              {m.selected ? (
                <>
                  <h2>{m.selected.victim_name}</h2>
                  <p className="mono">{m.selected.complaint_id}</p>
                  <div className="case-start-amount">
                    <AnimatedValue value={m.selected.amount_lost} money />
                  </div>
                  <span className="case-start-type">{m.selected.scam_type}</span>
                  <dl>
                    <dt>Bank</dt>
                    <dd>{m.selected.victim_bank}</dd>
                    <dt>Filed</dt>
                    <dd>{formatDate(m.selected.complaint_date)}</dd>
                  </dl>
                  <button className="primary" onClick={m.run} disabled={m.investigation.loading}>
                    Trace Funds
                    <ArrowRight size={17} />
                  </button>
                  <button className="text-button" onClick={() => m.setControlsOpen(true)}>
                    <SlidersHorizontal size={15} />
                    Trace options
                  </button>
                </>
              ) : (
                <p>No complaints are available in this dataset.</p>
              )}
              <div className="case-start-note">
                <span>01</span>
                <p>
                  Trace the flow.
                  <br />
                  <small>Risk, connections, and reports follow from your selected evidence.</small>
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
