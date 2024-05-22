import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { GetArtifactFunction } from '../types';
import { findContractTree } from './artifacts';
import { createError, ValidationError } from './error';
import { findAll } from './finders';

import type {
  StateVariableDeclarationVariable,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types';

interface Params {
  contracts: string[];
  getArtifact: GetArtifactFunction;
}

export async function validateMutableStateVariables({ contracts, getArtifact }: Params) {
  const errors: ValidationError[] = [];

  for (const fqName of contracts) {
    const { sourceName, contractName } = parseFullyQualifiedName(fqName);
    const artifact = await getArtifact(sourceName);
    const contractNodes = await findContractTree(getArtifact, artifact, contractName);

    for (const contractNode of contractNodes) {
      for (const node of findAll(contractNode, 'VariableDeclaration', _isMutableStateVariable)) {
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
