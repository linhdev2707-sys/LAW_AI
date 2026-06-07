import { z } from 'zod';

/**
 * Format a zod ZodError into a flat { field: messages[] } map.
 * Useful for returning API-friendly validation errors.
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!formatted[path]) formatted[path] = [];
    formatted[path].push(issue.message);
  }
  return formatted;
}
