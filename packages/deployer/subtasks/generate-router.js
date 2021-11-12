const fs = require('fs');
const path = require('path');
const filterValues = require('filter-values');
const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getCommit, getBranch } = require('@synthetixio/core-js/utils/git');
const { readPackageJson } = require('@synthetixio/core-js/utils/npm');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { renderTemplate } = require('../internal/generate-contracts');
const { getAllSelectors } = require('../internal/contract-helper');
const { toPrivateConstantCase } = require('../internal/router-helper');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../task-names');

const TAB = '    ';

subtask(
  SUBTASK_GENERATE_ROUTER_SOURCE,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
).setAction(async (_, hre) => {
  const routerName = 'Router';
  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    `${routerName}.sol`
  );

  logger.subtitle('Generating router source');
  logger.debug(`location: ${routerPath}`);

  const modules = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);
  const modulesNames = Object.keys(modules);
  logger.debug(`modules: ${JSON.stringify(modulesNames, null, 2)}`);

  const selectors = await getAllSelectors(modulesNames);
  logger.debug(`selectors: ${JSON.stringify(selectors, null, 2)}`);
  logger.debug(`Found ${modulesNames.length} modules with ${selectors.length} selectors in total`);

  const binaryData = _buildBinaryData({ selectors });

  let packageJson;
  try {
    packageJson = readPackageJson();
  } catch (err) {
    packageJson = { name: '' };
  }

  const generatedSource = renderTemplate(hre.deployer.paths.routerTemplate, {
    project: packageJson.name,
    repo: packageJson.repository?.url || '',
    branch: getBranch(),
    commit: getCommit(),
    moduleName: routerName,
    modules: _renderModules(modules),
    selectors: _renderSelectors({ binaryData }),
  });

  logger.debug(`Generated source: ${generatedSource}`);

  const currentSource = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';
  if (currentSource !== generatedSource) {
    fs.writeFileSync(routerPath, generatedSource);
    logger.success(`Router code generated and written to ${routerPath}`);
  } else {
    logger.checked('Router source did not change');
  }
});

function _renderSelectors({ binaryData }) {
  let selectorsStr = '';

  function renderNode(node, indent) {
    if (node.children.length > 0) {
      const childA = node.children[0];
      const childB = node.children[1];

      function findMidSelector(node) {
        if (node.selectors.length > 0) {
          return node.selectors[0];
        } else {
          return findMidSelector(node.children[0]);
        }
      }
      const midSelector = findMidSelector(childB);

      selectorsStr += `\n${TAB.repeat(4 + indent)}if lt(sig,${midSelector.selector}) {`;
      renderNode(childA, indent + 1);
      selectorsStr += `\n${TAB.repeat(4 + indent)}}`;

      renderNode(childB, indent);
    } else {
      selectorsStr += `\n${TAB.repeat(4 + indent)}switch sig`;
      for (const s of node.selectors) {
        selectorsStr += `\n${TAB.repeat(4 + indent)}case ${
          s.selector
        } { result := ${toPrivateConstantCase(s.contractName)} } // ${s.contractName}.${s.name}()`;
      }
      selectorsStr += `\n${TAB.repeat(4 + indent)}leave`;
    }
  }

  renderNode(binaryData, 0);

  return selectorsStr.trim();
}

/**
 * Get a string of modules constants with its deployedAddresses.
 * E.g.:
 *   address private constant _ANOTHER_MODULE = 0xAA...;
 *   address private constant _OWNER_MODULE = 0x5c..;
 */
function _renderModules(modules) {
  return Object.entries(modules)
    .reduce((lines, [moduleName, moduleData]) => {
      const { deployedAddress } = moduleData;
      lines.push(
        `${TAB}address private constant ${toPrivateConstantCase(moduleName)} = ${deployedAddress};`
      );
      return lines;
    }, [])
    .join('\n')
    .trim();
}

function _buildBinaryData({ selectors }) {
  const maxSelectorsPerSwitchStatement = 9;

  function binarySplit(node) {
    if (node.selectors.length > maxSelectorsPerSwitchStatement) {
      const midIdx = Math.ceil(node.selectors.length / 2);

      const childA = binarySplit({
        selectors: node.selectors.splice(0, midIdx),
        children: [],
      });

      const childB = binarySplit({
        selectors: node.selectors.splice(-midIdx),
        children: [],
      });

      node.children.push(childA);
      node.children.push(childB);

      node.selectors = [];
    }

    return node;
  }

  let binaryData = {
    selectors,
    children: [],
  };

  const finalData = binarySplit(binaryData);

  logger.debug(`binary tree: ${JSON.stringify(finalData, null, 2)}`);

  return finalData;
}
