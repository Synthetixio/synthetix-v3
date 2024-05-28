import {
  ContractDefinition,
  ElementaryTypeName,
  Identifier,
  ImportDirective,
  SourceUnit,
  StructDefinition,
  TypeName,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types';
import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import {
  GetArtifactFunction,
  StorageArtifact,
  StorageDump,
  StorageDumpLayout,
  StorageDumpSlot,
} from '../types';
import { findNodeReferenceArtifact } from './artifacts';
import { findAll, findContract, findOne } from './finders';
import { iterateContracts } from './iterators';
import { render } from './render';

interface ContractOrLibrary extends ContractDefinition {
  kind: 'contract' | 'library';
}

interface Params {
  getArtifact: GetArtifactFunction;
  contracts: string[];
  version?: string;
  license?: string;
}

export async function dumpStorage({ getArtifact, contracts }: Params) {
  const results: StorageDump = {};

  for (const [artifact, contractNode] of await _getContracts(getArtifact, contracts)) {
    const result: StorageDumpLayout = {
      name: contractNode.name,
      kind: contractNode.kind,
      structs: {},
    };

    const contractName = contractNode.name;
    const sourceName = artifact.sourceName;
    const fqName = `${sourceName}:${contractName}`;

    for (const structDefinition of findAll(contractNode, 'StructDefinition')) {
      const struct: StorageDumpSlot[] = [];

      for (const member of structDefinition.members) {
        struct.push(...(await _astVariableToStorageSlots(getArtifact, artifact, member)));
      }

      if (struct.length) {
        result.structs[structDefinition.name] = struct;
      }
    }

    if (Object.keys(result.structs).length > 0) {
      results[fqName] = result;
    }
  }

  return results;
}

async function _astVariableToStorageSlots(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  member: VariableDeclaration,
  namePrefix = ''
) {
  if (!member.typeName) {
    throw new Error('Missing type notation');
  }

  const name = namePrefix ? `${namePrefix}.${member.name}` : member.name;

  const typeName = (await _isContractReference(getArtifact, artifact, member.typeName))
    ? // If it is a reference to a contract, define the type as `address`
      ({
        type: 'ElementaryTypeName',
        name: 'address',
        stateMutability: null,
      } satisfies ElementaryTypeName)
    : member.typeName;

  if (typeName.type === 'ElementaryTypeName') {
    return [{ name, type: typeName.name }];
  }

  return [];

  throw new Error(`"${typeName.type}" not implemented for generating storage layout`);
}

async function _isContractReference(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  typeName: TypeName
) {
  if (typeName.type !== 'UserDefinedTypeName') return false;
  if (typeName.namePath.includes('.')) return false; // using point notation, its for sure not a contract reference

  const isContract = await findNodeReferenceArtifact(
    getArtifact,
    'ContractDefinition',
    artifact,
    typeName.namePath
  );

  return isContract;
}

async function _getContracts(getArtifact: GetArtifactFunction, contracts: string[]) {
  return Promise.all(
    contracts.map(async (fqName) => {
      const { sourceName, contractName } = parseFullyQualifiedName(fqName);
      const artifact = await getArtifact(sourceName);
      const contractNode = findContract(artifact.ast, contractName, (node) =>
        ['contract', 'library'].includes(node.kind)
      ) as ContractOrLibrary;
      if (!contractNode) return;
      return [artifact, contractNode];
    })
  ).then((results) => results.filter(Boolean) as [StorageArtifact, ContractOrLibrary][]);
}

/**
 * Generate a single solidity file including all the given contracts but only
 * rendering its storage defintions.
 */
export async function dumpStorageOld({
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
    if (contractNode.kind === 'interface') continue;

    const contractName = contractNode.name;
    const sourceName = artifact.sourceName;
    const fqName = `${sourceName}:${contractName}`;

    // if (contractName !== 'RewardDistribution') continue;
    // if (contractName !== 'Proxy') continue;

    const resultNode = clone(contractNode);

    const enumDefinitions = findAll(contractNode, 'EnumDefinition');
    const structDefinitions = findAll(contractNode, 'StructDefinition');

    // This function mutates the given structDefinition nodes
    await _replaceContractReferencesForAddresses(getArtifact, artifact, structDefinitions);

    const importDirectives = await _getDependencyImportDirectives(
      getArtifact,
      artifact,
      structDefinitions
    );

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
    // TODO: check how fixed arrays interact

    if (!resultNode.subNodes.length) continue;

    // Render the contract only including storage definitions
    const contract = render(resultNode as any);

    result.push(`// @custom:artifact ${fqName}`);
    result.push(...importDirectives.map(render));
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
  structDefinitions: StructDefinition[]
) {
  const results: SourceUnit[] = [];

  for (const structDefinition of structDefinitions) {
    for (const ref of findAll(structDefinition, 'VariableDeclaration')) {
      if (ref.typeName?.type !== 'UserDefinedTypeName') continue;
      if (ref.typeName.namePath.includes('.')) continue; // using point notation, its for sure not a contract reference

      const isContract = await findNodeReferenceArtifact(
        getArtifact,
        'ContractDefinition',
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

async function _getDependencyImportDirectives(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  structDefinitions: StructDefinition[]
) {
  const results: ImportDirective[] = [];

  const refs = structDefinitions
    .map((structDefinition) => findAll(structDefinition, 'UserDefinedTypeName'))
    .flat();

  for (const ref of refs) {
    const refName = ref.namePath.split('.')[0]!;

    const isLocal = findOne(
      artifact.ast,
      ['StructDefinition', 'EnumDefinition'],
      (node) => node.name === refName
    );

    if (isLocal) continue;

    const [refArtifact, canonicalRefName] = await findNodeReferenceArtifact(
      getArtifact,
      'ContractDefinition',
      artifact,
      refName
    );

    const isAliased = canonicalRefName !== refName;

    const symbolAlias = [canonicalRefName, isAliased ? refName : null] satisfies [
      string,
      string | null,
    ];
    const symbolAliasesIdentifier = [
      {
        type: 'Identifier',
        name: canonicalRefName,
      } satisfies Identifier,
      isAliased
        ? {
            type: 'Identifier',
            name: refName,
          }
        : null,
    ] satisfies [Identifier, Identifier | null];

    const exists = results.find(
      (importDirective) => importDirective.path === refArtifact.sourceName
    );

    if (exists) {
      if (!exists.symbolAliases) exists.symbolAliases = [];
      if (!exists.symbolAliasesIdentifiers) exists.symbolAliasesIdentifiers = [];

      const symbolExists = !!exists.symbolAliases.find(([name]) => name === canonicalRefName);
      if (!symbolExists) {
        exists.symbolAliases.push(symbolAlias);
        exists.symbolAliasesIdentifiers.push(symbolAliasesIdentifier);
      }
    } else {
      results.push({
        type: 'ImportDirective',
        path: refArtifact.sourceName,
        pathLiteral: {
          type: 'StringLiteral',
          value: refArtifact.sourceName,
          parts: [refArtifact.sourceName],
          isUnicode: [false],
        },
        unitAlias: null,
        unitAliasIdentifier: null,
        symbolAliases: [symbolAlias],
        symbolAliasesIdentifiers: [symbolAliasesIdentifier],
      });
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
