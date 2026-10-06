import { serveNativePublishedMedia } from '@/features/smart-textbook-runtime/server/native-published-media.server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = serveNativePublishedMedia;
export const HEAD = serveNativePublishedMedia;
