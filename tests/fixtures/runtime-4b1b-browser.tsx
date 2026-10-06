import {createRoot} from 'react-dom/client';
import {StrictMode} from 'react';
import {PublishedRuntimeEntry} from '../../src/features/smart-textbook-runtime/components/published-runtime-entry';
// Only bootstraps the actual new app component; no substitute Renderer/ports.
createRoot(document.getElementById('root')!).render(<StrictMode><PublishedRuntimeEntry backHref="/student/dashboard/courses/korean?course=korean-level-one"/></StrictMode>);
