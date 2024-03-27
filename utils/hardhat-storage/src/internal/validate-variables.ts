import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import { getFullyQualifiedName } from 'hardhat/utils/contract-names';
import { VariableDeclaration } from 'solidity-ast/types';
import { createError } from './error';
import { iterateContracts, iterateVariables } from './iterators';
import { ValidateParams } from './validate';

export function validateMutableStateVariables({ sourceUnits, skip }: ValidateParams) {
  const contractNodes = [
    // Filter out contracts that are marked to be skipped
    ...iterateContracts(sourceUnits, (sourceUnit, contractNode) => {
      const sourceName = sourceUnit.absolutePath;
      const contractName = contractNode.name;
      const fqName = getFullyQualifiedName(sourceName, contractName);
      return filterContracts([fqName, sourceName, contractName], skip).length === 0;
    }),
  ];

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
