const { equal, notEqual, deepEqual } = require('assert/strict');
const { findContractDefinitions } = require('../../../utils/ast/finders');
const { buildContractsStructMap } = require('../../../utils/ast/storage-struct');
const asts = require('../../fixtures/asts.json');

describe('utils/ast/storage-struct.js', function () {
  describe('build a contracts struct map', () => {
    let structsMap;

    before('builds a contract struct map from an asts object', async () => {
      const contractNodes = Object.values(asts).map(findContractDefinitions).flat();
      structsMap = await buildContractsStructMap(contractNodes);
    });

    it('handles asts without contract definitions', async () => {
      const result = await buildContractsStructMap([]);
      deepEqual(result, []);
    });

    it('should have 4 structs', () => {
      equal(structsMap.length, 4, 'structsMap should have 4 structs');
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
      const contractStruct = structsMap.find((item) => item.contract.name === 'ProxyNamespace');
      notEqual(contractStruct, undefined);
      equal(
        contractStruct.struct.members.some(
          (v) => v.name === 'implementation' && v.type === 'address'
        ),
        true
      );
      equal(
        contractStruct.struct.members.some(
          (v) => v.name === 'simulatingUpgrade' && v.type === 'bool'
        ),
        true
      );
    });
  });
});
