import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGraphData } from './useGraphData';
import { useTrace } from './useTrace';
import { useTimeline } from './useTimeline';
import { usePlayback } from './usePlayback';
import { useDNA } from './useDNA';
import { useCaseSummary } from './useCaseSummary';
import { useNotifications, usePlaybackNotifications } from './useNotifications';
import { useReportDownload } from './useReportDownload';
import { useReviewChecklist } from './useReviewChecklist';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useWorkspaceNavigation, type WorkspaceSection } from './useWorkspaceNavigation';
import { emptyGraph, filterGraph, mergeGraphs } from '../utils/graph';
import { projectStory } from '../utils/playback';
import type { Selection, TraceOptions, ViewMode } from '../types';

export function useInvestigationWorkspace() {
  const navigation = useWorkspaceNavigation();
  const workspace = useGraphData();
  const investigation = useTrace();
  const dna = useDNA(investigation.trace);
  const timeline = useTimeline(investigation.trace);
  const playback = usePlayback(timeline.events);
  const summary = useCaseSummary(investigation.trace);
  const notifications = useNotifications(investigation.trace);
  const report = useReportDownload(investigation.trace, notifications.push);
  const checklist = useReviewChecklist(investigation.trace);
  const [caseId, setCaseId] = useState('');
  const [options, setOptions] = useState<TraceOptions>({
    max_depth: 4,
    min_amount: '100',
    forwarding_window_hours: 24,
  });
  const [selection, setSelection] = useState<Selection>(null);
  const [suspicious, setSuspicious] = useState(false);
  const [view, setView] = useState<ViewMode>('Route');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [fitRevision, setFitRevision] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ id: string; revision: number }>();
  const [showDNA, setShowDNA] = useState(true);
  const [focusedEntity, setFocusedEntity] = useState<string>();
  const catalog = workspace.data?.graph;
  const catalogNodes = useMemo(() => catalog?.nodes.map((node) => node.data) || [], [catalog]);
  const complaints = workspace.data?.complaints || [];
  const selected = complaints.find((caseRecord) => caseRecord.complaint_id === caseId);
  const { reset } = investigation;
  useEffect(() => {
    setCaseId(workspace.data?.complaints[0]?.complaint_id || '');
    setSelection(null);
    setInspectorOpen(false);
    reset();
  }, [workspace.data, reset]);
  useEffect(() => {
    setShowDNA(true);
    setFocusedEntity(undefined);
  }, [investigation.trace]);
  const { section } = navigation;
  const { dispatch } = playback;
  useEffect(() => {
    if (controlsOpen) setInspectorOpen(false);
  }, [controlsOpen]);
  useEffect(() => {
    if (section !== 'trace') notifications.clearStory();
  }, [section, notifications.clearStory]);
  useEffect(() => {
    if ((section !== 'trace' || controlsOpen) && playback.playing) dispatch({ type: 'pause' });
  }, [section, controlsOpen, playback.playing, dispatch]);
  function navigate(next: WorkspaceSection) {
    setControlsOpen(false);
    setFocusMode(false);
    navigation.navigate(next);
  }
  function changeCase(id: string) {
    reset();
    setSelection(null);
    setCaseId(id);
    setRecordsOpen(false);
    setInspectorOpen(false);
    navigate('trace');
  }
  function changeOptions(next: TraceOptions) {
    reset();
    setSelection(null);
    setOptions(next);
    setInspectorOpen(false);
  }
  function run() {
    if (!selected || !catalog) return;
    navigate('trace');
    setSelection(null);
    setInspectorOpen(false);
    void investigation.run(caseId, options, catalog.dataset_version);
  }
  function expand(id: string) {
    if (catalog && !investigation.loading) {
      setSuspicious(false);
      void investigation.expand(id, catalog.dataset_version);
    }
  }
  const select = useCallback((value: Selection) => {
    setSelection(value);
    if (value) setInspectorOpen(true);
  }, []);
  function searchAccount(id: string) {
    navigate('trace');
    setSelection({ kind: 'node', id });
    setInspectorOpen(true);
    dispatch({ type: 'overview' });
    setFocusRequest((old) => ({ id, revision: (old?.revision || 0) + 1 }));
    expand(id);
  }
  function analyzeDNA() {
    navigate('dna');
    dispatch({ type: 'overview' });
    setShowDNA(true);
    setFocusedEntity(undefined);
    void dna.run();
  }
  function investigateLinkedCase(id: string) {
    if (!catalog) return;
    changeCase(id);
    void investigation.run(id, options, catalog.dataset_version);
  }
  const combinedGraph = useMemo(() => {
    const base = investigation.graph || emptyGraph();
    return dna.data && showDNA ? mergeGraphs(base, dna.data.link_graph) : base;
  }, [investigation.graph, dna.data, showDNA]);
  const graph = useMemo(
    () => filterGraph(combinedGraph, suspicious, investigation.trace?.start_account),
    [combinedGraph, suspicious, investigation.trace],
  );
  const story = useMemo(
    () =>
      investigation.trace && playback.mode === 'story'
        ? projectStory(timeline.events, playback.step, investigation.trace)
        : undefined,
    [timeline.events, playback.mode, playback.step, investigation.trace],
  );
  usePlaybackNotifications(
    investigation.trace,
    timeline.events,
    playback,
    catalogNodes,
    summary.data,
    notifications.push,
    notifications.clearStory,
  );
  useKeyboardShortcuts(
    {
      toggle: () => dispatch({ type: 'toggle' }),
      previous: () => dispatch({ type: 'seek', step: playback.step - 1 }),
      next: () => dispatch({ type: 'seek', step: playback.step + 1 }),
      replay: () => dispatch({ type: 'replay' }),
      fit: () => setFitRevision((old) => old + 1),
      deselect: () => setSelection(null),
    },
    section === 'trace' && !!timeline.events.length,
    section === 'trace' && !!graph.nodes.length,
  );
  return {
    navigation: { section, navigate },
    workspace,
    investigation,
    dna,
    timeline,
    playback,
    summary,
    notifications,
    report,
    checklist,
    caseId,
    selected,
    complaints,
    catalog,
    catalogNodes,
    options,
    selection,
    suspicious,
    view,
    controlsOpen,
    inspectorOpen,
    recordsOpen,
    focusMode,
    fitRevision,
    focusRequest,
    showDNA,
    focusedEntity,
    graph,
    combinedGraph,
    story,
    changeCase,
    changeOptions,
    run,
    expand,
    select,
    searchAccount,
    analyzeDNA,
    investigateLinkedCase,
    setControlsOpen,
    setInspectorOpen,
    setRecordsOpen,
    setFocusMode,
    setSelection,
    setSuspicious,
    setView,
    setShowDNA,
    setFocusedEntity,
  };
}
export type InvestigationWorkspace = ReturnType<typeof useInvestigationWorkspace>;
