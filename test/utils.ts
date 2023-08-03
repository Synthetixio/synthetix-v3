import { wei } from '@synthetixio/wei';

export const raise = (err: string): never => {
  throw new Error(err);
};

export const bn = (n: number) => wei(n).toBN();

export const isNil = <A>(a: A | undefined | null): boolean => a === undefined || a === null;

export const shuffle = <A>(arr: A[]): A[] => {
  const arr2 = [...arr];
  for (let i = arr2.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr2[i];
    arr2[i] = arr2[j];
    arr2[j] = temp;
  }
  return arr2;
};
