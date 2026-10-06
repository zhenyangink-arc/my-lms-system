'use client';

import { useMemo } from 'react';
import {
  createNativeLearningSessionTransport,
  type NativeSessionBootstrap,
} from '../core/native-learning-session-transport';
import type { RuntimeServices } from '../core/services';
import { RuntimeRoot } from './runtime-root';

/** The published native lesson has no legacy content, teacher or submit port. */
async function unsupported(): Promise<never> {
  throw new Error('NATIVE_LEGACY_SERVICE_UNSUPPORTED');
}

export function NativeCourseRuntime({ bootstrap, backHref }: {
  bootstrap: NativeSessionBootstrap;
  backHref: string;
}) {
  const activation = useMemo(() => {
    try {
      const transport = createNativeLearningSessionTransport(bootstrap);
      const { manifest, context, initialState } = transport.bootstrap;
      if (manifest.compatibility.profile !== 'native'
        || manifest.teachingRefs.length !== 0
        || manifest.steps.some(step => step.teachingRef !== null)
        || manifest.blocks.some(block => block.type !== 'video' && block.type !== 'multiple_choice')) {
        throw new Error('NATIVE_PRESENTATION_UNSUPPORTED');
      }
      const services: RuntimeServices = {
        context,
        initialState,
        nativeExecution: transport.nativeExecution,
        refresh: transport.refresh,
        learning: unsupported,
        submit: unsupported,
        teacher: {
          turn: unsupported,
          // RuntimeRoot calls this on disposal; no teacher was started.
          cancel: async () => {},
        },
      };
      return { manifest, services };
    } catch {
      return null;
    }
  }, [bootstrap]);

  if (!activation) {
    return <p role="alert">教材暂时无法加载，请返回课程后重试。</p>;
  }
  return <RuntimeRoot manifest={activation.manifest} services={activation.services}
    validationMode="complete" backHref={backHref} />;
}
