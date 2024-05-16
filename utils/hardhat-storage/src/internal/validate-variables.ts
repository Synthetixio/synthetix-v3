import { StorageArtifact } from '../types';
import { createError, ValidationError } from './error';
import { findAll, findOne } from './finders';

import type {
  StateVariableDeclarationVariable,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types';

interface Params {
  artifacts: StorageArtifact[];
}

export function validateMutableStateVariables({ artifacts }: Params) {
  const errors: ValidationError[] = [];

  for (const { sourceName, contractName, ast } of artifacts) {
    const contractNode = findOne(ast, 'ContractDefinition', (node) => node.name === contractName);

    if (!contractNode) {
      throw new Error(`Contract with name "${contractName}" not found`);
    }

    for (const node of findAll(ast, 'VariableDeclaration', _isMutableStateVariable)) {
      errors.push(
        createError({
          message:
            'Unsafe state variable declaration. Mutable state variables cannot be declared on a contract behind a Proxy',
          sourceName,
          nodes: [contractNode, node],
        })
      );
    }
  }

  return errors;
}

function _isMutableStateVariable(node: VariableDeclaration) {
  return (
    node.isStateVar &&
    !node.isDeclaredConst &&
    !(node as StateVariableDeclarationVariable).isImmutable
  );
}
