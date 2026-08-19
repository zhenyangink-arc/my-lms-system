import { DEFAULT_PRIORITY_ORDER } from "@/features/student-home-learning/priority";

import type { PlatformLearningRuleDefaults } from "./types.ts";

/** Packet 11 first-release defaults; later storage-backed settings can replace this object. */
export const PLATFORM_LEARNING_RULE_DEFAULTS = {
  taskPriorityOrder: DEFAULT_PRIORITY_ORDER,
  dueSoonHours: 24,
  maxSystemSuggestions: 5,
  weakSkillMasteryPercentBelow: 70,
  reviewErrorCountAtLeast: 2,
  weeklyTargetDays: 5,
  weeklyTargetMinutes: 150,
} as const satisfies PlatformLearningRuleDefaults;
