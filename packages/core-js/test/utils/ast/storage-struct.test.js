const path = require('path');
const { equal, notEqual, deepEqual } = require('assert/strict');
const { findContractDefinitions } = require('../../../utils/ast/finders');
const { buildContractsStructMap } = require('../../../utils/ast/storage-struct');
const parseContracts = require('../../helpers/parse-contracts');

describe('utils/ast/storage-struct.js', function () {
  describe('build a contracts struct map', () => {
    let structsMap;
    let sampleProject;

    before('load sample-project artifacts', async function () {
      const envPath = path.resolve(__dirname, '..', '..', 'fixtures', 'sample-project');
      sampleProject = await parseContracts(envPath);
    });

    before('builds a contract struct map from an asts object', async () => {
      const contractNodes = findContractDefinitions(
        sampleProject.asts['contracts/ElectionStorage.sol']
      );
      structsMap = await buildContractsStructMap(contractNodes);
    });

    it('handles asts without contract definitions', async () => {
      const result = await buildContractsStructMap([]);
      deepEqual(result, []);
    });

    it('should have 5 structs', () => {
      equal(structsMap.length, 5, 'structsMap should have 5 structs');
    });

    it('all strutcs should conform with the basic format', () => {
      for (const contractStruct of structsMap) {
        notEqual(contractStruct.contract, undefined);
        notEqual(contractStruct.contract.name, undefined);
        notEqual(contractStruct.contract.id, undefined);
        notEqual(contractStruct.struct, undefined);
        notEqual(contractStruct.struct.name, undefined);
        notEqual(contractStruct.struct.members, undefined);
      }
    });

    it('should find all the members', () => {
      const contractStruct = structsMap.find((item) => item.contract.name === 'ElectionStorage');
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
