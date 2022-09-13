import path from 'path';
import { deepEqual, equal, notEqual } from 'assert/strict';

import parseContracts, { ParsedContracts } from '../../helpers/parse-contracts';
import { ContractsStruct, buildContractsStructMap } from '../../../src/utils/ast/storage-struct';
import { findContractDefinitions } from '../../../src/utils/ast/finders';

describe('utils/ast/storage-struct.ts', function () {
  describe('build a contracts struct map', function () {
    let structsMap: ContractsStruct[];
    let sampleProject: ParsedContracts;

    before('load sample-project artifacts', async function () {
      const envPath = path.resolve(__dirname, '..', '..', 'fixtures', 'sample-project');
      sampleProject = await parseContracts(envPath);
    });

    before('builds a contract struct map from an asts object', async function () {
      const contractNodes = findContractDefinitions(
        sampleProject.asts!['contracts/ElectionStorage.sol']
      );
      structsMap = await buildContractsStructMap(contractNodes);
    });

    it('handles asts without contract definitions', async function () {
      const result = await buildContractsStructMap([]);
      deepEqual(result, []);
    });

    it('should have 5 structs', function () {
      equal(structsMap.length, 5, 'structsMap should have 5 structs');
    });

    it('all strutcs should conform with the basic format', function () {
      for (const contractStruct of structsMap) {
        notEqual(contractStruct.contract, undefined);
        notEqual(contractStruct.contract.name, undefined);
        notEqual(contractStruct.contract.id, undefined);
        notEqual(contractStruct.struct, undefined);
        notEqual(contractStruct.struct.name, undefined);
        notEqual(contractStruct.struct.members, undefined);
      }
    });

    it('should find all the members', function () {
      const contractStruct = structsMap.find((item) => item.contract.name === 'ElectionStorage')!;
      notEqual(contractStruct, undefined);
      equal(
        contractStruct.struct.members.some((v) => v.name === 'initialized' && v.type === 'bool'),
        true
      );
      equal(
        contractStruct.struct.members.some(
          (v) => v.name === 'councilToken' && v.type === 'address'
        ),
        true
      );
    });
  });
});
