import { studentTransport } from '@/features/teaching-agent/server/transport/production';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
 return studentTransport.status(request, (await context.params).runId);
}
