'use server';
import { requirePlatformOwner } from '@/lib/admin';
import { createCanonicalBinding } from '../server/native-activity-authoring.server';

export async function createNativeActivityAction() {
  const { supabase } = await requirePlatformOwner();
  try {
    const receipt = await createCanonicalBinding(supabase);
    return {status:'CONFIRMED' as const,receipt};
  } catch {
    // Do not leak SQL errors/arguments or invite an unknown-commit retry.
    return {status:'VERIFY_REQUIRED' as const,receipt:null};
  }
}
