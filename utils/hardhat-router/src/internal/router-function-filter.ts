/**
 * Default function filter to not add functions with name starting with "c_0x"
 * to the Router. These functions are added by the "solidity-coverage" library
 * during coverage tests when instrumenting the contracts.
 */
export const routerFunctionFilter = (fnName: string) => !fnName.startsWith('c_0x');
