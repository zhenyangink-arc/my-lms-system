import {runtimeApplicationPost} from '@/features/smart-textbook-runtime/server/application-http.server';
export const runtime='nodejs';
export async function POST(request:Request){return runtimeApplicationPost(request,'teacher');}
