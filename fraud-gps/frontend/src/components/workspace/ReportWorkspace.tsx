import { ArrowLeft, FileCheck2, FileDown, ShieldCheck } from 'lucide-react';
import type { InvestigationWorkspace } from '../../hooks/useInvestigationWorkspace';
import { CaseSummaryPanel } from '../reports/CaseSummaryPanel';

export function ReportWorkspace({ model: m }: { model: InvestigationWorkspace }) {
  return (
    <section className="report-workspace module-page">
      <header className="module-heading">
        <div>
          <p className="eyebrow">FROM EVIDENCE TO ACTION</p>
          <h1>A case, clearly documented.</h1>
          <p>Review the findings and prepare your investigation report.</p>
        </div>
        <button onClick={() => m.navigation.navigate('trace')}>
          <ArrowLeft size={15} />
          Back to trail
        </button>
      </header>
      <div className="report-workspace-grid">
        <CaseSummaryPanel
          trace={m.investigation.trace}
          data={m.summary.data}
          loading={m.summary.loading}
          error={m.summary.error}
          onRetry={m.summary.retry}
          onAccount={m.searchAccount}
          onCase={m.investigateLinkedCase}
          reviewed={m.checklist.reviewed}
          onReview={m.checklist.toggle}
          onResetReviews={m.checklist.reset}
          downloading={m.report.loading}
          onDownload={() => void m.report.download()}
        />
        <aside className="report-document">
          <div className="document-preview">
            <span>FRAUD GPS / INVESTIGATION</span>
            <FileCheck2 size={42} />
            <h2>
              Investigation
              <br />
              report
            </h2>
            <p>{m.caseId || 'No active case'}</p>
            <i />
            <i />
            <i />
            <small>CONFIDENTIAL · SYNTHETIC DATA</small>
          </div>
          <h3>{m.investigation.trace ? 'Ready for review.' : 'Start with a money trail.'}</h3>
          <p>
            Complaint, money trail, risk evidence, Fraud DNA, and recommended actions in one
            source-linked document.
          </p>
          <button
            className="primary"
            disabled={!m.investigation.trace || m.report.loading}
            onClick={() => void m.report.download()}
          >
            <FileDown size={16} />
            {m.report.loading ? 'Generating…' : 'Download PDF'}
          </button>
          <small>
            <ShieldCheck size={14} />
            Uses the active trace settings.
          </small>
        </aside>
      </div>
    </section>
  );
}
