export function activeTargetKeys(values: Record<string, unknown>): string[] {
  return Object.keys(values).filter(key => key.startsWith('applied:') && values[key] === 'yes');
}
export function keepGlobalOnRestore(values: Record<string, unknown>, currentScopeKey: string): boolean {
  return activeTargetKeys(values).some(key => key !== 'applied:' + currentScopeKey);
}