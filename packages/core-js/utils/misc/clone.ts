export function clone(objectToClone: any) {
  return JSON.parse(JSON.stringify(objectToClone));
}
