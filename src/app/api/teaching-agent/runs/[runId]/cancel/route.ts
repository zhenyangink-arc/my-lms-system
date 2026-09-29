import { studentTransport } from '@/features/teaching-agent/server/transport/production';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
 return studentTransport.cancel(request, (await context.params).runId);
}
