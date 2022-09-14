export function clone<T>(objectToClone: T): T {
  return JSON.parse(JSON.stringify(objectToClone));
}
