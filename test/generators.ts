import crypto from 'crypto';
import { ethers } from 'ethers';

export const genAddress = () => ethers.Wallet.createRandom().address;
export const genBytes32 = () => ethers.utils.formatBytes32String(crypto.randomBytes(8).toString('hex'));
export const genFloat = (min = 0, max = 1) => Math.random() * (max - min + 1) + min;
export const genInt = (min = 0, max = 1) => Math.floor(genFloat(min, max));

// --- Core Utilities --- //

export const raise = (err: string): never => {
  throw new Error(err);
};

export const isNil = <A>(a: A | undefined | null): boolean => a === undefined || a === null;
export const genTimes = <A>(n: number, f: (n?: number) => A) => [...Array(n).keys()].map(f);
export const genSample = <A>(a: A[]): A => a[Math.floor(Math.random() * a.length)];
export const genOption = <A>(f: () => A): A | undefined => (genSample([true, false]) ? f() : undefined);

export const genOneOf = <A>(l: A[]): A => {
  const a = genSample(l);
  return isNil(a) ? raise('oneOf found invalid sequence') : a;
};

export const genListOf = <A>(n: number, f: (n?: number) => A): A[] =>
  n <= 0 ? raise('listOf found invalid n') : genTimes(n, f);
