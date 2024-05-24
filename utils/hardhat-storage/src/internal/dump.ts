import {
  ContractDefinition,
  ElementaryTypeName,
  SourceUnit,
  StructDefinition,
} from '@solidity-parser/parser/src/ast-types';
import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { GetArtifactFunction, StorageArtifact } from '../types';
import { findContractReferenceArtifact } from './artifacts';
import { findAll, findOne } from './finders';
import { iterateContracts } from './iterators';
import { render } from './render';

interface Params {
  contracts: string[];
  getArtifact: GetArtifactFunction;
  version?: string;
  license?: string;
}

/**
 * Generate a single solidity file including all the given contracts but only
 * rendering its storage defintions.
 */
export async function dumpStorage({
  contracts,
  getArtifact,
  version,
  license = 'UNLICENSED',
}: Params) {
  const artifacts = await Promise.all(
    contracts.map(async (fqName) => {
      const { sourceName } = parseFullyQualifiedName(fqName);
      return await getArtifact(sourceName);
    })
  );

  const result = [
    `// SPDX-License-Identifier: ${license}`,
    version ? `pragma solidity ${version};` : _renderPragmaDirective(artifacts),
    '',
  ];

  for (const [artifact, contractNode] of iterateContracts(artifacts)) {
    const contractName = contractNode.name;
    const sourceName = artifact.sourceName;
    const fqName = `${sourceName}:${contractName}`;

    if (contractName !== 'RewardDistribution') continue;
    // if (contractName !== 'CcipClient') continue;

    const resultNode = clone(contractNode);

    const enumDefinitions = findAll(contractNode, 'EnumDefinition');
    const structDefinitions = findAll(contractNode, 'StructDefinition');

    // This function mutates the given structDefinition nodes
    await _replaceContractReferencesForAddresses(
      getArtifact,
      artifact,
      contractNode,
      structDefinitions
    );

    // const dependencies = _getDependencySourceUnits(sourceUnits, structDefinitions);
    // const importDirectives = findChildren(sourceUnit, 'ImportDirective').filter((importDirective) =>
    //   dependencies.some((dependency) => dependency.id === importDirective.sourceUnit)
    // );

    // Filter all the contract nodes to only include Structs
    resultNode.subNodes = [...enumDefinitions, ...structDefinitions];

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

    if (!resultNode.subNodes.length) continue;

    // Render the contract only including storage definitions
    const contract = render(resultNode as any);

    result.push(`// @custom:artifact ${fqName}`);
    // result.push(...(importDirectives as any).map(render));
    result.push(contract);
    result.push('');
  }

  return result.join('\n');
}

function _renderPragmaDirective(artifacts: StorageArtifact[]) {
  // TODO: calculate the best solc version based on all the files, instead of using
  // the one from the last file
  const node = findOne(artifacts[artifacts.length - 1].ast, 'PragmaDirective');

  if (!node) {
    throw new Error('Could not find pragma directive on dump file');
  }

  return render(node);
}

async function _replaceContractReferencesForAddresses(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  contractNode: ContractDefinition,
  structDefinitions: StructDefinition[]
) {
  const results: SourceUnit[] = [];

  for (const structDefinition of structDefinitions) {
    for (const ref of findAll(structDefinition, 'VariableDeclaration')) {
      if (ref.typeName?.type !== 'UserDefinedTypeName') continue;
      if (ref.typeName.namePath.includes('.')) continue; // using point notation, its for sure not a contract reference

      const isContract = await findContractReferenceArtifact(
        getArtifact,
        artifact,
        ref.typeName.namePath
      );

      if (!isContract) continue;

      ref.typeName = {
        type: 'ElementaryTypeName',
        name: 'address',
        stateMutability: null,
      } satisfies ElementaryTypeName;
    }
  }

  return results;
}

// function _getDependencySourceUnits(
//   sourceUnits: SourceUnit[],
//   structDefinitions: StructDefinition[]
// ) {
//   const results: SourceUnit[] = [];

//   for (const structDefinition of structDefinitions) {
//     for (const reference of findAll(structDefinition, 'UserDefinedTypeName')) {
//       const sourceUnit = sourceUnits.find((sourceUnit) => {
//         return !!findOne(
//           sourceUnit,
//           ['StructDefinition', 'EnumDefinition'],
//           (node) => node.id === reference.referencedDeclaration
//         );
//       });

//       if (!sourceUnit) {
//         throw new Error(`SourceUnit not found for "${reference.pathNode?.name}"`);
//       }

//       if (!results.some((node) => node.id === sourceUnit.id)) {
//         results.push(sourceUnit);
//       }
//     }
//   }

//   return results;
// }

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
