import { deepEqual } from 'node:assert/strict';
import { SourceUnit } from 'solidity-ast';
import { validateInterfaces } from '../../../src/internal/validate-interfaces';
import { routerFunctionFilter } from '../../../src/internal/router-function-filter';
import { loadAst } from '../../helpers/load-ast';

describe('internal/validate-interfaces.ts', function () {
  let astNodes: SourceUnit[];

  before('load asts', async function () {
    astNodes = await loadAst('contracts/InterfacedModules.sol');
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
