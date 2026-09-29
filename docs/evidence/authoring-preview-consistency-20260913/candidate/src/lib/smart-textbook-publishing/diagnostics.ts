import 'server-only';
/** Type-only client imports; publication modules never become browser runtime imports.
 * Explicit owner-facing projection. Never carry raw exception text or private JSON paths. */
export type PublicationDiagnostic = {
  code: 'identity' | 'content' | 'teaching' | 'media' | 'binding' | 'capture' | 'format';
  stepId: string | null;
  stepTitle: string;
  area: string;
  message: string;
  action: 'content' | 'teaching' | 'refresh';
};
