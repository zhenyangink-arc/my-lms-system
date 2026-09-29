import { studentTransport } from '@/features/teaching-agent/server/transport/production';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = studentTransport.post;
