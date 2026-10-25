import { ArrowLeft, ArrowUpRight, Dna, Route } from 'lucide-react';
import type { InvestigationWorkspace } from '../../hooks/useInvestigationWorkspace';
import { DNAPanel } from '../dna/DNAPanel';

export function ConnectionsWorkspace({ model: m }: { model: InvestigationWorkspace }) {
  return (
    <section className="connections-workspace module-page">
      <header className="module-heading">
        <div>
          <p className="eyebrow">CROSS-CASE INTELLIGENCE</p>
          <h1>The connections behind the case.</h1>
          <p>Shared identifiers, observed behavior, and network patterns.</p>
        </div>
        <button onClick={() => m.navigation.navigate('trace')}>
          <ArrowLeft size={15} />
          Back to trail
        </button>
      </header>
      <div className="module-context">
        <Dna size={19} />
        <div>
          <strong>{m.caseId || 'Choose a case'}</strong>
          <small>{m.selected?.victim_name || 'Start by selecting a complaint.'}</small>
        </div>
        {m.dna.data && (
          <button
            onClick={() => {
              m.setShowDNA(true);
              m.navigation.navigate('trace');
            }}
          >
            <Route size={15} />
            View connections on graph
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      {!m.investigation.trace?.steps.length && (
        <div className="module-prerequisite">
          <p>Trace a case to compare its evidence with other complaints.</p>
          <button onClick={() => m.navigation.navigate('trace')}>
            Open money trail
            <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <DNAPanel
        key={m.caseId}
        report={m.dna.data}
        trace={m.investigation.trace}
        catalog={m.catalog}
        loading={m.dna.loading}
        error={m.dna.error}
        onAnalyze={m.analyzeDNA}
        onCase={m.investigateLinkedCase}
        onAccount={m.searchAccount}
        focusedEntity={m.focusedEntity}
        onEntity={m.setFocusedEntity}
      />
    </section>
  );
}
