'use server';
import { chapterWorkbenchOperation } from './service.server';
export async function chapterWorkbenchAction(input: unknown) {
  return chapterWorkbenchOperation(input);
}
