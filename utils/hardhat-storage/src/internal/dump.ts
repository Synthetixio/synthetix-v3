import { findAll } from '@synthetixio/core-utils/utils/ast/finders';
import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { SourceUnit } from 'solidity-ast/types';
import { iterateContracts, iterateSlotAssignments } from './iterators';
import { render } from './render';

/**
 * Generate a single solidity file including all the given contracts but only
 * rendering its storage defintions.
 */
export async function dumpStorage(
  astNodes: SourceUnit[],
  version?: string,
  license = 'UNLICENSED'
) {
  if (!Array.isArray(astNodes) || !astNodes.length) {
    throw new Error('No solidity files found');
  }

  const result = [
    `// SPDX-License-Identifier: ${license}`,
    version ? `pragma solidity ${version};` : _renderPragmaDirective(astNodes),
    '',
  ];

  for (const [sourceUnit, contractNode] of iterateContracts(astNodes)) {
    const sourceName = sourceUnit.absolutePath;
    const contractName = contractNode.name;
    const fqName = `${sourceName}:${contractName}`;

    const resultNode = clone(contractNode);

    const constDeclarations = findAll(
      contractNode,
      'VariableDeclaration',
      (node) => node.mutability === 'constant' || node.mutability === 'immutable'
    );
    const enumDefinitions = findAll(contractNode, 'EnumDefinition');
    const structDefinitions = findAll(contractNode, 'StructDefinition');
    const slotAssignments = [...iterateSlotAssignments([sourceUnit])].map(
      ([, , functionNode]) => functionNode
    );

    // Filter all the contract nodes to only include Structs and Storage Slot Definitions
    resultNode.nodes = [
      ...constDeclarations,
      ...enumDefinitions,
      ...structDefinitions,
      ...slotAssignments,
    ];

    if (!resultNode.nodes.length) continue;

    // Render the contract only including storage definitions
    const contract = render(resultNode);

    result.push(`// @custom:artifact ${fqName}`, contract, '');
  }

  return result.join('\n');
}

function _renderPragmaDirective(sourceUnits: SourceUnit[]) {
  const sourceUnit = sourceUnits[sourceUnits.length - 1];
  // TODO: calculate the best solc version based on all the files, instead of using
  // the one from the last file
  for (const node of findAll(sourceUnit, 'PragmaDirective')) return render(node);
}
