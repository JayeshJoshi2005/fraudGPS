import { useInvestigationWorkspace } from './hooks/useInvestigationWorkspace';
import { Header } from './components/layout/Header';
import { WorkspaceNav } from './components/workspace/WorkspaceNav';
import { CaseLibrary } from './components/workspace/CaseLibrary';
import { TraceWorkspace } from './components/workspace/TraceWorkspace';
import { ConnectionsWorkspace } from './components/workspace/ConnectionsWorkspace';
import { ReportWorkspace } from './components/workspace/ReportWorkspace';
import { CaseSetup } from './components/workspace/CaseSetup';
import { ToastViewport } from './components/alerts/ToastViewport';

export default function App() {
  const m = useInvestigationWorkspace();
  return (
    <div
      className={`app-shell modular-shell ${m.focusMode && m.navigation.section === 'trace' ? 'graph-focus' : ''}`}
      id="workspace"
    >
      <button
        className="skip-workspace"
        onClick={() => document.getElementById('workspace-main')?.focus()}
      >
        Skip to workspace
      </button>
      <WorkspaceNav
        section={m.navigation.section}
        navigate={m.navigation.navigate}
        ready={!!m.workspace.data}
      />
      <Header
        complaints={m.complaints}
        nodes={m.catalogNodes}
        ready={!!m.workspace.data && !m.investigation.loading}
        onCase={m.changeCase}
        onAccount={m.searchAccount}
        datasetVersion={m.catalog?.dataset_version}
        reportReady={!!m.investigation.trace?.complaint_id && !m.investigation.loading}
        reportLoading={m.report.loading}
        reportError={m.report.error}
        onReport={() => void m.report.download()}
        caseId={m.caseId}
        onSettings={() => m.setControlsOpen(!m.controlsOpen)}
        settingsOpen={m.controlsOpen}
        onReload={() => {
          m.investigation.reset();
          m.setSelection(null);
          m.workspace.retry();
        }}
      />
      <main
        className={`module-content section-${m.navigation.section}`}
        id="workspace-main"
        tabIndex={-1}
        inert={m.controlsOpen}
      >
        <div className="module-slot" hidden={m.navigation.section !== 'cases'}>
          <CaseLibrary model={m} />
        </div>
        <div className="module-slot trace-slot" hidden={m.navigation.section !== 'trace'}>
          <TraceWorkspace model={m} />
        </div>
        <div className="module-slot" hidden={m.navigation.section !== 'dna'}>
          <ConnectionsWorkspace model={m} />
        </div>
        <div className="module-slot" hidden={m.navigation.section !== 'summary'}>
          <ReportWorkspace model={m} />
        </div>
      </main>
      {m.controlsOpen && <CaseSetup model={m} />}
      <ToastViewport items={m.notifications.items} onDismiss={m.notifications.dismiss} />
    </div>
  );
}
