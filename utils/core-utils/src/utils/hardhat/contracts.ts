import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonFragment } from '@ethersproject/abi';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName, parseName } from 'hardhat/utils/contract-names';
import micromatch from 'micromatch';
import { SourceUnit } from 'solidity-ast';
import { findImportsRecursive } from '../ast/finders';

interface AbiMap {
  [contractFullyQualifiedName: string]: ReadonlyArray<JsonFragment>;
}

/**
 * Check if the given contract path is inside the sources folder.
 */
export function contractIsInSources(contractSourcePath: string, hre: HardhatRuntimeEnvironment) {
  const source = path.resolve(hre.config.paths.root, contractSourcePath);
  return source.startsWith(`${hre.config.paths.sources}${path.sep}`);
}

/**
 * Get a list of all the contracts fully qualified names that are present or imported
 * on the local contracts/ folder.
 * It can include a whitelist filter by contractName, contractSource,
 * or if its included in a given folder.
 */
export async function getContractsFullyQualifiedNames(
  hre: HardhatRuntimeEnvironment,
  patterns: string[] = ['*']
) {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();
  return filterContracts(contractFullyQualifiedNames, patterns);
}

/**
 * Filter the given contracts using multimatch. It can include a whitelist filter
 * by contractName, contractSource, or if its included in a given folder.
 */
export function filterContracts(contracts: string[], patterns: string[] = ['*']) {
  if (patterns.length === 1 && /^\*+$/.test(patterns[0])) {
    return [...contracts];
  }

  const matches = (items: string[], patterns: string[]) => micromatch(items, patterns).length > 0;

  const blacklist = patterns.filter((w) => w.startsWith('!')).map((b) => b.slice(1));
  const whitelist = patterns.filter((w) => !w.startsWith('!'));

  return contracts.filter((name) => {
    const { sourceName, contractName } = parseName(name);
    const item = [name, contractName];
    if (sourceName) item.push(sourceName);
    return !matches(item, blacklist) && matches(item, whitelist);
  });
}

export async function getContractsAbis(hre: HardhatRuntimeEnvironment, patterns: string[]) {
  const filtered = await getContractsFullyQualifiedNames(hre, patterns);

  const result: AbiMap = {};

  await Promise.all(
    filtered.map(async (fqName) => {
      const { abi } = await hre.artifacts.readArtifact(fqName);
      result[fqName] = abi;
    })
  );

  return result;
}

export async function getContractAst(
  hre: HardhatRuntimeEnvironment,
  contractFullyQualifiedName: string
) {
  const { sourceName } = parseFullyQualifiedName(contractFullyQualifiedName);
  const buildInfo = await hre.artifacts.getBuildInfo(contractFullyQualifiedName);

  if (!buildInfo) {
    throw new Error(`Build info for "${contractFullyQualifiedName}" not found`);
  }

  return buildInfo.output.sources[sourceName].ast as SourceUnit;
}

export async function getContractsAsts(hre: HardhatRuntimeEnvironment, fqNames: string[]) {
  const astSources = await _getAllAsts(hre);
  const astNodes = Object.values(astSources);

  const result: { [sourceName: string]: SourceUnit } = {};

  for (const fqName of fqNames) {
    const { sourceName } = parseFullyQualifiedName(fqName);
    const sources = findImportsRecursive(sourceName, astNodes);

    for (const sourceName of sources) {
      if (!astSources[sourceName]) throw new Error(`Missing AST for "${sourceName}"`);
      result[sourceName] = astSources[sourceName];
    }
  }

  return Object.values(result).sort((a, b) =>
    a.absolutePath > b.absolutePath ? 1 : a.absolutePath < b.absolutePath ? -1 : 0
  );
}

async function _getAllAsts(hre: HardhatRuntimeEnvironment) {
  const buildPaths = await hre.artifacts.getBuildInfoPaths();

  const result: { [sourceName: string]: SourceUnit } = {};

  for (const buildPath of buildPaths) {
    const buffer = await fs.readFile(buildPath);
    const buildInfo = JSON.parse(buffer.toString());
    const sources = Object.values(buildInfo.output.sources) as { ast: SourceUnit }[];

    for (const { ast } of sources) {
      result[ast.absolutePath] = ast;
    }
  }

  return result;
}
