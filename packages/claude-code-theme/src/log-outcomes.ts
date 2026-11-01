export function explicitOutcome(data: unknown, depth = 0): 'error' | 'success' | 'returned' {
  if (depth > 4 || !data || typeof data !== 'object' || Array.isArray(data)) return 'returned';
  const obj = data as Record<string, unknown>;
  if (obj.success === false || obj.ok === false || (typeof obj.exitCode === 'number' && obj.exitCode !== 0)) return 'error';
  let result: 'error' | 'success' | 'returned' = obj.success === true || obj.ok === true || obj.exitCode === 0 ? 'success' : 'returned';
  for (const key of ['data', 'result', 'execution_result']) {
    const child = explicitOutcome(obj[key], depth + 1);
    if (child === 'error') return 'error';
    if (child === 'success') result = child;
  }
  return result;
}