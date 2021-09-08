const fs = require('fs');
const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_GENERATE_IMC_SOURCE } = require('../task-names');
const { getCommit, getBranch } = require('../utils/git');
const { readPackageJson } = require('../utils/package');
const { getContractNameFromPath, processContracts } = require('../utils/contracts');
const { getNonce, nextNonce, evaluateNextDeployedContractAddress } = require('../utils/provider');
const renderTemplate = require('../utils/render-template');

const TAB = '    ';

subtask(
  SUBTASK_GENERATE_IMC_SOURCE,
  'Pre-calculates the modules addresses and generates the source for a new IMCMixin contract.'
).setAction(async ({ dummyImc }, hre) => {
  logger.subtitle(`Generating ${dummyImc ? 'fake ' : '' }IMCMixin source`);
  const modules = hre.deployer.data.contracts.modules;

  const { toUpdate, toCreate } = await processContracts(modules);

  const initialNonce = dummyImc ? 1 : await getNonce();
  await _preCalculateModuleAddresses(
    initialNonce,
    [...toUpdate, ...toCreate],
    modules,
    dummyImc ? ethers.Wallet.createRandom() : undefined
  );

  const modulesPaths = Object.keys(modules);
  logger.debug(`modules: ${JSON.stringify(modulesPaths, null, 2)}`);

  const package = readPackageJson();

  const generatedSource = renderTemplate(hre.deployer.paths.imcMixinTemplate, {
    project: package.name,
    repo: package.repository?.url || '',
    branch: getBranch(),
    commit: getCommit(),
    moduleName: hre.deployer.imcMixinModule,
    modulesAddress: _renderModules(modules),
    is_fake: dummyImc,
  });

  logger.debug(`generated source: ${generatedSource}`);

  const { imcMixinPath } = hre.deployer.paths;
  const currentSource = fs.existsSync(imcMixinPath) ? fs.readFileSync(imcMixinPath) : '';
  if (currentSource !== generatedSource) {
    fs.writeFileSync(imcMixinPath, generatedSource);
    logger.success(`IMCMixin code generated and written to ${imcMixinPath}`);
  } else {
    logger.checked('IMCMixin source did not change');
  }
});

/**
 * Get a string of modules constants with its deployedAddresses.
 * E.g.:
 *   address internal constant AModuleAddress = 0xAA...;
 *   address internal constant OwnerModuleAddress = 0x5c..;
 */
function _renderModules(modules) {
  return Object.entries(modules)
    .reduce((lines, [modulePath, moduleData]) => {
      const moduleName = getContractNameFromPath(modulePath);
      const { preCalculatedAddress } = moduleData;
      lines.push(`${TAB}address internal constant ${moduleName}Address = ${preCalculatedAddress};`);
      return lines;
    }, [])
    .join('\n')
    .trim();
}

async function _preCalculateModuleAddresses(initialNonce, modulesToDeploy, modules, signer) {
  let nonce = initialNonce;
  for (let i = 0; i < modulesToDeploy.length; i++) {
    const key = modulesToDeploy[i][0];
    const address = await evaluateNextDeployedContractAddress(nonce, signer);
    modules[key].preCalculatedAddress = address;
    nonce = nextNonce(nonce);
  }
}
