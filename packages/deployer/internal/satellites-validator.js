const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const {
  findContractDependencies,
  findFunctionNodes,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

const SATELLITE_FACTORY =
  '@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol:SatelliteFactory';

class SatellitesValidator {
  constructor(moduleFullyQualifiedNames, astNodes) {
    this.moduleFullyQualifiedNames = moduleFullyQualifiedNames;
    this.astNodes = astNodes;
  }

  validateSatelliteGetters() {
    const errors = [];

    for (const contractFqName of this._findSatelliteFactories()) {
      const { contractName } = parseFullyQualifiedName(contractFqName);
      const functionName = `get${capitalize(contractName)}Satellites`;

      const hasSatellitesGetter = findFunctionNodes(contractFqName, this.astNodes).find(
        (node) => node.name === functionName
      );

      if (!hasSatellitesGetter) {
        errors.push({
          contractName: contractFqName,
          msg: `SatelliteFactory contract "${contractFqName}" is missing the getter function "${functionName}"`,
        });

        continue;
      }
    }

    return errors;
  }

  _findSatelliteFactories() {
    return this.moduleFullyQualifiedNames.filter((contractFqName) =>
      findContractDependencies(contractFqName, this.astNodes).includes(SATELLITE_FACTORY)
    );
  }
}

module.exports = SatellitesValidator;
