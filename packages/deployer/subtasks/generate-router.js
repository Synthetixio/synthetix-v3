const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../task-names');
const { getSelectors } = require('../utils/getSelectors');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getCommit, getBranch } = require('../utils/git');
const { readPackageJson } = require('../utils/package');

const TAB = '    ';

let _hre;

/*
 * Reads deployed modules from the deployment data file
 * and generates the source for a new router contract.
 * */
subtask(SUBTASK_GENERATE_ROUTER_SOURCE).setAction(async (_, hre) => {
  _hre = hre;

  logger.log(chalk.cyan('Generating router source'));

  const data = readDeploymentFile({ hre });

  const modules = _collectModules({ data });
  const selectors = await _collectSelectors({ modules });

  const binaryData = _buildBinaryData({ selectors });

  const package = readPackageJson({ hre });

  const generatedSource = _readRouterTemplate()
    .replace('@project', package.name)
    .replace('@repo', package.repository.url)
    .replace('@branch', getBranch())
    .replace('@commit', getCommit())
    .replace('@network', _hre.network.name)
    .replace('@modules', _renderModules({ modules }))
    .replace('@selectors', _renderSelectors({ binaryData }));

  fs.writeFileSync(`contracts/Router_${_hre.network.name}.sol`, generatedSource);

  logger.log(chalk.green('Router code generated'));
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
        selectorsStr += `\n${TAB.repeat(4 + indent)}case ${s.selector} { result := ${
          s.module
        } } // ${s.module}.${s.name}()`;
      }
      selectorsStr += `\n${TAB.repeat(4 + indent)}leave`;
    }
  }

  renderNode(binaryData, 0);

  return selectorsStr;
}

function _renderModules({ modules }) {
  let modulesStr = '';

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];

    modulesStr += `\n${TAB.repeat(1)}address constant ${module.name} = ${module.address};`;
  }

  return modulesStr;
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

  return binarySplit(binaryData);
}

function _collectModules({ data }) {
  return Object.keys(data.modules).map((moduleName) => {
    const { deployedAddress } = data.modules[moduleName];

    return {
      name: moduleName,
      address: deployedAddress,
    };
  });
}

async function _collectSelectors({ modules }) {
  let allSelectors = [];

  for (let module of modules) {
    let selectors = await getSelectors({ contractName: module.name, hre: _hre });

    selectors.map((s) => (s.module = module.name));

    allSelectors = allSelectors.concat(selectors);
  }

  allSelectors = allSelectors.sort((a, b) => {
    return parseInt(a.selector, 16) - parseInt(b.selector, 16);
  });

  logger.log(
    chalk.gray(`Found ${modules.length} modules with ${allSelectors.length} selectors in total`)
  );

  return allSelectors;
}

function _readRouterTemplate() {
  return fs.readFileSync(path.join(__dirname, '../templates/Router'), 'utf8');
}
