import {
  findContractDependencies,
  findContractNodeWithAst,
} from '@synthetixio/core-utils/utils/ast/finders';
import { onlyUnique } from '@synthetixio/core-utils/utils/misc/array';
import { SourceUnit, VariableDeclaration } from 'solidity-ast/types';
import { createError } from './error';
import { iterateVariables } from './iterators';

interface Params {
  /** fully qualified names of the contracts to validate */
  artifacts: string[];
  /** all source units, including the ones in artifacts and all the imported ones */
  sourceUnits: SourceUnit[];
}

export function validateMutableStateVariables({ artifacts, sourceUnits }: Params) {
  // Find for all the dependencies also
  const fqNames = artifacts
    .map((fqName) => findContractDependencies(fqName, sourceUnits))
    .flat()
    .filter(onlyUnique);

  const contractNodes = fqNames.map((fqName) => findContractNodeWithAst(fqName, sourceUnits));

  // Find state variables
  const invalidVars = [...iterateVariables(contractNodes, _isMutableStateVariable)];

  return invalidVars.map(([sourceUnit, contractNode, variableNode]) =>
    createError({
      message:
        'Unsafe state variable declaration. Mutable state variables cannot be declared on a contract behind a Proxy',
      sourceUnit,
      nodes: [contractNode, variableNode],
    })
  );
}

function _isMutableStateVariable(variableNode: VariableDeclaration) {
  return (
    variableNode.stateVariable &&
    variableNode.mutability !== 'constant' &&
    variableNode.mutability !== 'immutable'
  );
}
