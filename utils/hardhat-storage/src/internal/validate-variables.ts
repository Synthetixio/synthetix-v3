import { VariableDeclaration } from 'solidity-ast/types';

import { ValidateParams } from './validate';
import { createError } from './error';
import { iterateVariables } from './iterators';

export function validateMutableStateVariables({ sourceUnits }: ValidateParams) {
  const invalidVars = [...iterateVariables(sourceUnits, _isMutableStateVariable)];
  return invalidVars.map(([sourceUnit, contractNode, node]) =>
    createError({
      message:
        'Unsafe state variable declaration. Mutable state variables cannot be declared on a contract behind a Proxy',
      sourceUnit,
      nodes: [contractNode, node],
    })
  );
}

function _isMutableStateVariable(node: VariableDeclaration) {
  return node.stateVariable && !['constant', 'immutable'].includes(node.mutability);
}
