import fs from 'node:fs/promises';
import path from 'node:path';
import glob from 'fast-glob';
import { NativeCompiler } from 'hardhat/internal/solidity/compiler';
import { CompilerDownloader } from 'hardhat/internal/solidity/compiler/downloader';
import { getCompilersDir } from 'hardhat/internal/util/global-dir';
import { CompilerInput, CompilerOutput as HardhatCompilerOutput } from 'hardhat/types';
import { version as CurrentSolcVersion } from 'solc/package.json';
import { SourceUnit } from 'solidity-ast';

export interface CompileParams {
  rootDir?: string;
  sources?: string | string[];
  version?: string;
}

export interface CompilerOutput extends Omit<HardhatCompilerOutput, 'sources'> {
  sources: {
    [sourceName: string]: {
      ast: SourceUnit;
    };
  };
}

export async function compileSolidityContents(
  contents: { [sourceName: string]: string },
  version = CurrentSolcVersion
) {
  const compiler = await _getCompiler(version);

  const sources: { [sourceName: string]: { content: string } } = {};

  for (const [sourceName, content] of Object.entries(contents)) {
    sources[sourceName] = { content };
  }

  const input: CompilerInput = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: {},
      outputSelection: {
        '*': { '': ['ast'] },
      },
    },
  };

  const output = await compiler.compile(input);

  if (output.errors && output.errors.some((x: { severity: string }) => x.severity === 'error')) {
    console.error(output.errors);
    throw new Error('There was an error during compilation');
  }

  const sourceUnits = Object.values((output as CompilerOutput).sources).map(({ ast }) => ast);

  return sourceUnits.sort((a, b) =>
    a.absolutePath > b.absolutePath ? 1 : a.absolutePath < b.absolutePath ? -1 : 0
  );
}

export async function compileSolidityFolder({
  rootDir = process.cwd(),
  sources = '**/*.sol',
  version = CurrentSolcVersion,
}: CompileParams) {
  const sourceNames = await glob(sources, { cwd: rootDir });
  const contents: { [sourceName: string]: string } = {};

  await Promise.all(
    sourceNames.map(async (sourceName) => {
      const file = path.resolve(rootDir, sourceName);
      const content = (await fs.readFile(file)).toString();
      contents[sourceName] = content;
    })
  );

  return compileSolidityContents(contents, version);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _getCompiler(version: string): Promise<any> {
  const downloader = new CompilerDownloader(
    CompilerDownloader.getCompilerPlatform(),
    await getCompilersDir()
  );

  const isDownloaded = await downloader.isCompilerDownloaded(version);

  if (!isDownloaded) {
    await downloader.downloadCompiler(version);
  }

  const buildInfo = await downloader.getCompiler(version);

  return new NativeCompiler(buildInfo!.compilerPath);
}
