import 'server-only';
export function studentTransportEnabled(value = process.env.TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED) { return value === '1' || value === 'true'; }
export const transportHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' };
