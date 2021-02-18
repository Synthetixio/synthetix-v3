const fs = require('fs');
const path = require('path');
const { subtask } = require('hardhat/config');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');

subtask('deploy-modules').setAction(async (taskArguments, hre) => {
  console.log('deploying modules...');

  const deploymentData = _getDeploymentData();
  const sourceModules = _getSourceModules();

  _cleanupModules({ deploymentData, sourceModules });

  await _deployModules({ deploymentData, sourceModules });

  _saveDeploymentData({ deploymentData });
});

async function _deployModules({ deploymentData, sourceModules }) {
  for (let moduleName of sourceModules) {
    const moduleData = deploymentData.modules[moduleName];

    console.log(moduleName);

    let needsDeployment = false;

    if (!needsDeployment && network.name === 'hardhat') {
      needsDeployment = true;
    }

    if (!needsDeployment && !moduleData.deployedAddress) {
      needsDeployment = true;
    }

    const sourceBytecodeHash = _getModuleBytecodeHash(moduleName);
    const storedBytecodeHash = moduleData.bytecodeHash;
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (!needsDeployment && bytecodeChanged) {
      needsDeployment = true;
    }

    if (needsDeployment) {
      console.log(`  > Deploying ${moduleName}...`);

      const factory = await ethers.getContractFactory(moduleName);
      const module = await factory.deploy();

      moduleData.deployedAddress = module.address;
      moduleData.bytecodeHash = sourceBytecodeHash;
    } else {
      console.log(`  > No need to deploy ${moduleName}`);
    }
  }
}

function _getModuleBytecodeHash(moduleName) {
  const file = fs.readFileSync(`artifacts/contracts/modules/${moduleName}.sol/${moduleName}.json`);
  const data = JSON.parse(file);

  return ethers.utils.sha256(data.bytecode);
}

function _saveDeploymentData({ deploymentData }) {
  const commitHash = _getGitCommitHash();

  const deploymentFile = readDeploymentFile();
  deploymentFile[commitHash] = deploymentData;

  saveDeploymentFile(deploymentFile);
}

// Retrieve saved data about this deployment.
// Note: Deployments are tracked by the hash of the current
// commit in the source code.
function _getDeploymentData() {
  const commitHash = _getGitCommitHash();

  const deploymentFile = readDeploymentFile();
  if (!deploymentFile[commitHash]) {
    deploymentFile[commitHash] = {};
  }

  const deploymentData = deploymentFile[commitHash];
  if (!deploymentData.modules) {
    deploymentData.modules = {};
  }

  return deploymentData;
}

// Read contracts/modules/*
function _getSourceModules() {
  const modulesPath = hre.config.deployer.paths.modules;
  return fs.readdirSync(modulesPath).map((file) => {
    const filePath = path.parse(file);
    if (filePath.ext === '.sol') {
      return filePath.name;
    }
  });
}

// Syncs modules found in contracts/modules/*
// with entries found in deployment.modules
function _cleanupModules({ deploymentData, sourceModules }) {
  // Remove entries from the file that are not
  // included in the current sources
  Object.keys(deploymentData.modules).map((deployedModule) => {
    if (!sourceModules.some((sourceModule) => deployedModule === sourceModule)) {
      deploymentData.modules[deployedModule] = null;
    }
  });

  // Make sure all modules found in sources
  // have an entry in the file
  sourceModules.map((sourceModule) => {
    if (!deploymentData.modules[sourceModule]) {
      deploymentData.modules[sourceModule] = {
        deployedAddress: '',
        bytecodeHash: '',
      };
    }
  });
}

function _getGitCommitHash() {
  return require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 40);
}
