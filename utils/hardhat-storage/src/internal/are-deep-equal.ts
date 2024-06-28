import { deepEqual } from 'node:assert';

export function areDeepEqual(a: unknown, b: unknown) {
  try {
    deepEqual(a, b);
    return true;
  } catch (_) {
    return false;
  }
}
