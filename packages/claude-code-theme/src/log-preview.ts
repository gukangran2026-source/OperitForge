// Keep the original result intact for copy; only simplify a display preview.
export function toolLogPreview(body: string): string {
  try {
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return body;
    const obj = data as Record<string, unknown>;
    for (const key of ['output', 'stdout', 'error', 'message']) {
      if (typeof obj[key] === 'string' && (obj[key] as string).trim()) {
        const command = typeof obj.command === 'string' ? '$ ' + obj.command + '\n' : '';
        return command + obj[key];
      }
    }
  } catch (_error) { /* ordinary text is already a valid preview */ }
  return body;
}