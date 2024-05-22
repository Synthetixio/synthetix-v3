import type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export interface StorageArtifact {
  sourceName: string;
  ast: SourceUnit;
}

export interface OldStorageArtifact extends StorageArtifact {
  contractName: string;
}

export type GetArtifactFunction = (sourceName: string) => Promise<StorageArtifact>;
