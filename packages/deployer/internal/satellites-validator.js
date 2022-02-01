const {
  contractHasDependency,
  findContractDefinitions,
  findContractNodeWithName,
  findFunctions,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

const SATELLITE_FACTORY = 'SatelliteFactory';

module.exports = class SatellitesValidator {
  constructor(astNodes) {
    this.astNodes = astNodes;
    this.satelliteFactoryNode = findContractNodeWithName(SATELLITE_FACTORY, astNodes);
    this.satelliteFactoryNodes = astNodes
      .flatMap(findContractDefinitions)
      .filter((contractNode) => contractNode.name !== SATELLITE_FACTORY)
      .filter((contractNode) => contractHasDependency(contractNode, SATELLITE_FACTORY, astNodes));
  }

  validateSatelliteGetters() {
    const errors = [];

    for (const satelliteFactoryNode of this.satelliteFactoryNodes) {
      const functionName = `get${capitalize(satelliteFactoryNode.name)}Satellites`;
      const getterNode = findFunctions(satelliteFactoryNode, this.astNodes).find(
        (node) => node.name === functionName
      );

      if (!getterNode) {
        errors.push({
          contractName: satelliteFactoryNode.name,
          msg: `SatelliteFactory contract "${satelliteFactoryNode.name}" is missing the getter function "${functionName}"`,
        });

        continue;
      }
    }

    return errors;
  }
};
