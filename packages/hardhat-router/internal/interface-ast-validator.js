const {
  findContractDependencies,
  findFunctionNodes,
  findContractNode,
} = require('@synthetixio/core-utils/dist/utils/ast/finders');

class InterfaceCoverageASTValidator {
  constructor(contractFullyQualifiedNames, astNodes, visibleFunctionsFilter) {
    this.contractFullyQualifiedNames = contractFullyQualifiedNames;
    this.astNodes = astNodes;
    this.visibleFunctionsFilter = visibleFunctionsFilter;
  }

  findFunctionsNotDefinedInInterfaces() {
    const errors = [];

    for (const contractFullyQualifiedName of this.contractFullyQualifiedNames) {
      const visibleFunctions = this._findVisibleFunctions(contractFullyQualifiedName);
      const interfacedFunctions = this._findInterfaceFunctions(contractFullyQualifiedName);

      for (const visibleFunction of visibleFunctions) {
        if (
          !interfacedFunctions.some((f) => f.functionSelector === visibleFunction.functionSelector)
        ) {
          errors.push({
            msg: `Visible function ${visibleFunction.name} of contract ${contractFullyQualifiedName} not found in the inherited interfaces`,
          });
        }
      }
    }

    return errors;
  }

  _findVisibleFunctions(contractFullyQualifiedName) {
    const visibleFunctions = findFunctionNodes(contractFullyQualifiedName, this.astNodes)
      .filter((f) => f.visibility === 'public' || f.visibility === 'external')
      .filter((f) => this.visibleFunctionsFilter(f.name));

    return visibleFunctions;
  }

  _findInterfaceFunctions(contractFullyQualifiedName) {
    const interfacedFunctions = [];

    const dependencies = findContractDependencies(contractFullyQualifiedName, this.astNodes);

    for (const dependencyFullyQualifiedName of dependencies) {
      const contractNode = findContractNode(dependencyFullyQualifiedName, this.astNodes);

      if (contractNode.contractKind != 'interface') {
        continue;
      }

      interfacedFunctions.push(...findFunctionNodes(dependencyFullyQualifiedName, this.astNodes));
    }

    return interfacedFunctions;
  }
}

module.exports = InterfaceCoverageASTValidator;
