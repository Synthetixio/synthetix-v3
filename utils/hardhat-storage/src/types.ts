import type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export interface StorageArtifact {
  sourceName: string;
  contractName: string;
  ast: SourceUnit;
}
