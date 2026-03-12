//
export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  delay = 500,
) {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
