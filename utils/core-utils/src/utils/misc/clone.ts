import rfdc from 'rfdc';

export function clone<T>(objectToClone: T): T {
  return rfdc()(objectToClone);
}
