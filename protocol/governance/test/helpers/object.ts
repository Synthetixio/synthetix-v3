type Obj = { [k: string]: unknown };

type Entry<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T];

export function typedValues<T>(obj: T) {
  return Object.values(obj as Obj) as T[keyof T][];
}

export function typedEntries<T>(obj: T) {
  return Object.entries(obj as Obj) as Entry<T>[];
}
