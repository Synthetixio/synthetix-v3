import { findAll, findChildren, findOne } from '@synthetixio/core-utils/utils/ast/finders';
import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { SourceUnit, StructDefinition } from 'solidity-ast/types';
import { iterateContracts } from './iterators';
import { render } from './render';

/**
 * Generate a single solidity file including all the given contracts but only
 * rendering its storage defintions.
 */
export async function dumpStorage(
  sourceUnits: SourceUnit[],
  version?: string,
  license = 'UNLICENSED'
) {
  if (!Array.isArray(sourceUnits) || !sourceUnits.length) {
    throw new Error('No solidity files found');
  }

  const result = [
    `// SPDX-License-Identifier: ${license}`,
    version ? `pragma solidity ${version};` : _renderPragmaDirective(sourceUnits),
    '',
  ];

  for (const [sourceUnit, contractNode] of iterateContracts(sourceUnits)) {
    const sourceName = sourceUnit.absolutePath;
    const contractName = contractNode.name;
    const fqName = `${sourceName}:${contractName}`;

    const resultNode = clone(contractNode);

    const enumDefinitions = findAll(contractNode, 'EnumDefinition');
    const structDefinitions = findAll(contractNode, 'StructDefinition');

    // This function mutates the given nodes
    _replaceContractReferencesForAddresses(structDefinitions);

    const dependencies = _getDependencySourceUnits(sourceUnits, structDefinitions);
    const importDirectives = findChildren(sourceUnit, 'ImportDirective').filter((importDirective) =>
      dependencies.some((dependency) => dependency.id === importDirective.sourceUnit)
    );

    // Filter all the contract nodes to only include Structs
    resultNode.nodes = [...enumDefinitions, ...structDefinitions];

    // TODO: handle enums, should not change storage size:
    /**
       function calculateEnumStorageSize(numValues: number): number {
          // Calculate the minimal number of bits needed to represent all enum values
          const bitsRequired = Math.ceil(Math.log2(numValues));

          // Convert bits to bytes, each byte holds 8 bits
          const bytesRequired = Math.ceil(bitsRequired / 8);

          return bytesRequired;
        }
       */
    // TODO: handle contracts references, they should be converted to address
    /**
        if (node.typeDescriptions.typeString?.startsWith('contract ')) {
          return 'address';
        }
     */
    // TODO: handle array and mappings with custom values
    // TODO: check how fixed arrays interact

    if (!resultNode.nodes.length) continue;

    // Render the contract only including storage definitions
    const contract = render(resultNode);

    result.push(`// @custom:artifact ${fqName}`);
    result.push(...importDirectives.map(render));
    result.push(contract);
    result.push('');
  }

  return result.join('\n');
}

function _renderPragmaDirective(sourceUnits: SourceUnit[]) {
  // TODO: calculate the best solc version based on all the files, instead of using
  // the one from the last file
  const node = findOne(sourceUnits.reverse(), 'PragmaDirective');

  if (!node) {
    throw new Error('Could not find pragma directive on dump file');
  }

  return render(node);
}

function _replaceContractReferencesForAddresses(structDefinitions: StructDefinition[]) {
  const results: SourceUnit[] = [];

  for (const structDefinition of structDefinitions) {
    for (const ref of findAll(structDefinition, 'UserDefinedTypeName')) {
      if (!ref.typeDescriptions.typeString?.startsWith('contract ')) continue;

      const parent = findOne(
        structDefinition,
        'VariableDeclaration',
        (variable) => variable.typeName?.id === ref.id
      );

      if (!parent) {
        throw new Error(`Parent VariableDeclaration not found for ${JSON.stringify(ref)}`);
      }

      parent.typeDescriptions = {
        typeIdentifier: 't_address',
        typeString: 'address',
      };

      parent.typeName = {
        id: ref.id,
        nodeType: 'ElementaryTypeName',
        name: 'address',
        src: ref.src,
        stateMutability: 'nonpayable',
        typeDescriptions: {
          typeIdentifier: 't_address',
          typeString: 'address',
        },
      };
    }
  }

  return results;
}

function _getDependencySourceUnits(
  sourceUnits: SourceUnit[],
  structDefinitions: StructDefinition[]
) {
  const results: SourceUnit[] = [];

  for (const structDefinition of structDefinitions) {
    for (const reference of findAll(structDefinition, 'UserDefinedTypeName')) {
      const sourceUnit = sourceUnits.find((sourceUnit) => {
        return !!findOne(
          sourceUnit,
          ['StructDefinition', 'EnumDefinition'],
          (node) => node.id === reference.referencedDeclaration
        );
      });

      if (!sourceUnit) {
        throw new Error(`SourceUnit not found for "${reference.pathNode?.name}"`);
      }

      if (!results.some((node) => node.id === sourceUnit.id)) {
        results.push(sourceUnit);
      }
    }
  }

  return results;
}

/**
 * Parse a previous generated storage dump
 */
export function parseStorageDump(source: string) {
  const [header, ...contractChunks] = source.split('// @custom:artifact ');

  const contents: { [fqName: string]: string } = {};
  for (const chunk of contractChunks) {
    const [fqName] = chunk.split('\n', 1);
    const sourceCode = chunk.slice(fqName.length);
    contents[fqName.trim()] = `${header}${sourceCode.trim()}\n`;
  }

  return contents;
}
