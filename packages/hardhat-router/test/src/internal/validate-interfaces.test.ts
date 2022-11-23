import path from 'node:path';
import { deepEqual } from 'node:assert/strict';
import { SourceUnit } from 'solidity-ast';
import { parse } from '@synthetixio/core-utils/utils/ast/parse';
import { validateInterfaces } from '../../../src/internal/validate-interfaces';
import { routerFunctionFilter } from '../../../src/internal/router-function-filter';

describe('internal/validate-interfaces.ts', function () {
  let astNodes: SourceUnit[];

  before('load asts', async function () {
    astNodes = await parse({
      version: '0.8.11',
      rootDir: path.resolve(__dirname, '..', '..', 'fixtures'),
    });
  });

  it('does not return any errors if interfaces are complete', async function () {
    const fqName = 'contracts/InterfacedModules.sol:ValidInterfacedModule';
    const errors = validateInterfaces([fqName], astNodes, routerFunctionFilter);

    deepEqual(errors, []);
  });

  it('returns an error on missing implementation', async function () {
    const fqName = 'contracts/InterfacedModules.sol:InvalidInterfacedModule';
    const fnName = 'anotherGetValue';
    const errors = validateInterfaces([fqName], astNodes, routerFunctionFilter);

    deepEqual(errors, [
      {
        msg: `Visible function "${fnName}" of contract "${fqName}" not found in the inherited interfaces`,
      },
    ]);
  });
});
