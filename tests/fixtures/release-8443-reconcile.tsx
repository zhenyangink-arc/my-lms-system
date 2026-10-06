// The exact same entry/data is bundled against reference and candidate src trees.
import React, { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Listing from '../../src/features/courses/components/course-catalog-listing';
import { TextbookStudio } from '../../src/features/digital-textbook/components/textbook-studio';
import { ChapterWorkbench } from '../../src/features/digital-textbook/workbench/chapter-workbench';
import { GrammarCardContent } from '../../src/features/digital-textbook/components/grammar-card-content';
import { RuntimeToolbar } from '../../src/features/smart-textbook-runtime/components/runtime-toolbar';
import { RuntimeClassroom } from '../../src/features/smart-textbook-runtime/components/runtime-root';
import { RuntimeServiceContext, LearningStateProvider } from '../../src/features/smart-textbook-runtime/components/runtime-context';
import { TeachingVideoPilotEditor } from '../../src/features/learning-agent-script-studio/TeachingVideoPilotEditor';
import type { RuntimeServices } from '../../src/features/smart-textbook-runtime/core/services';
import type { LessonManifestV1 } from '../../src/lib/smart-textbook-runtime-v1/contracts';
import type { TeachingScriptNode, TeachingScriptActivity } from '../../src/features/learning-agent-script-studio/types';
import type { DigitalTextbookDisplayRow } from '../../src/features/digital-textbook/components/digital-textbook-table/columns';
import { row, workbench, grammarCard, pilotNode, activity } from './release-8443-reconcile.mjs';

declare global {
  interface Window {
    reconcileCalls: unknown[];
    reconcileRuntime: {
      manifest: LessonManifestV1;
      context: RuntimeServices['context'];
      state: RuntimeServices['initialState'];
      content: Record<string, Awaited<ReturnType<RuntimeServices['learning']>>>;
    };
  }
}

function Toolbar() {
  const container = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useState<'zh-CN' | 'ko-KR'>('zh-CN');
  return <div ref={container}>
    <RuntimeToolbar container={container} title="第一章：你好" position={1} total={8}
      locale={locale} backHref="/courses" onLocaleChange={async next => {
        window.reconcileCalls.push({ locale: next });
        if (location.search.includes('error')) throw Error('synthetic');
        setLocale(next);
      }}>{null}</RuntimeToolbar>
  </div>;
}

function Pilot() {
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback((value: boolean) => setDirty(value), []);
  const onPending = useCallback(() => {}, []);
  const activities: TeachingScriptActivity[] = [{
    id: activity.id, key: activity.key, type: 'single_choice',
    prompt: { 'zh-CN': activity.prompt, 'ko-KR': activity.koreanPrompt },
  }];
  return <>
    <p data-dirty={dirty}>保存状态：{dirty ? '有未保存修改' : '已保存'}</p>
    <TeachingVideoPilotEditor node={pilotNode as TeachingScriptNode} activities={activities}
      editable={!location.search.includes('readonly')} formId="pilot-form" returnTo="/editor"
      onDirtyChange={onDirty} onPendingChange={onPending} />
  </>;
}

function Legacy() {
  const data = window.reconcileRuntime;
  const services: RuntimeServices = {
    context: data.context,
    initialState: data.state,
    submit: async () => ({
      ok: true, correct: true, score: 100, explanation: '隔离反馈', attemptNumber: 1,
      preview: true, nodeId: null, nodeCompleted: false, completionPercent: 0,
    }),
    learning: async ref => data.content[ref],
    teacher: { turn: async () => { throw Error('not installed'); }, cancel: async () => {} },
  };
  return <RuntimeServiceContext services={services}>
    <LearningStateProvider manifest={data.manifest}>
      <RuntimeClassroom manifest={data.manifest} omitTeacher backHref="/courses" />
    </LearningStateProvider>
  </RuntimeServiceContext>;
}

async function boot() {
  window.reconcileCalls = [];
  const query = new URLSearchParams(location.search);
  const surface = query.get('surface') ?? 'catalog';
  let ui: React.ReactNode;
  if (surface === 'catalog') {
    ui = await Listing({ studentAppId: 'app', routeBasePath: '/',
      searchParams: Promise.resolve(Object.fromEntries(query)), textbookRoute: '/textbooks' });
  } else if (surface === 'textbook') {
    ui = <TextbookStudio rows={query.has('empty') ? [] : [row as DigitalTextbookDisplayRow]}
      canManage={!query.has('readonly')} canPublish={!query.has('readonly')}
      workbenchHref="/workbench" courseStructureRoute="/content" />;
  } else if (surface === 'workbench') {
    const initial = query.has('empty') ? { ...workbench, steps: [] }
      : query.has('readonly') ? {
        ...workbench, steps: workbench.steps.map(step => ({ ...step,
          nodes: step.nodes.map(node => ({ ...node, grammarCards: [],
            activities: node.activities.map(item => ({ ...item, editable: false })) })),
        })),
      } : workbench;
    ui = <ChapterWorkbench initial={initial} contentHref="/textbooks"
      previewHref="/preview" scriptsHref="/scripts" />;
  } else if (surface === 'grammar') {
    ui = <GrammarCardContent card={grammarCard} />;
  } else if (surface === 'toolbar') {
    ui = <Toolbar />;
  } else if (surface === 'editor') {
    ui = <Pilot />;
  } else {
    window.reconcileRuntime = await fetch('/runtime-data').then(response => response.json());
    ui = <Legacy />;
  }
  createRoot(document.getElementById('root')!).render(
    <main data-dashboard-ui="management" style={{ maxWidth: 1440, margin: 'auto', padding: 16 }}>{ui}</main>,
  );
}

void boot().then(() => {
  document.documentElement.dataset.fixtureReady = 'true';
}).catch(error => {
  document.documentElement.dataset.fixtureError = String(error);
  throw error;
});
