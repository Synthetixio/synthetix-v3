'use strict';

/*global task*/

require('dotenv').config();

const { types } = require('hardhat/config');
const ethers = require('ethers');
const w3utils = require('web3-utils');

const inquirer = require('inquirer');
const autocomplete = require('inquirer-autocomplete-prompt');
const figlet = require('figlet');
const levenshtein = require('js-levenshtein');
const { yellow, green, red, cyan, gray } = require('chalk');

const packageJson = require('../package.json');

const { logReceipt, logError } = require('../utils/prettyLog');

const { sendTx, confirmTx } = require('@synthetixio/core-js/utils/runTx');
const { setupProvider } = require('@synthetixio/core-js/utils/setupProvider');
const {
  getDeploymentFilePath,
  getDeploymentData,
  getTarget,
  getSource,
} = require('@synthetixio/core-js/utils/deploymentHelper');

const { TASK_INTERACT_NAME, TASK_INTERACT_DESC } = require('../tasks-info');

const ARTIFACTS_JSON_NAME = 'deployment.json';

async function printHeader({
  providerUrl,
  network,
  instance,
  gasPrice,
  deploymentFilePath,
  wallet,
}) {
  console.clear();

  async function figprint(msg, font) {
    return new Promise((resolve, reject) => {
      figlet.text(msg, { font }, function (err, res) {
        if (err) {
          reject(err);
        }
        resolve(res);
      });
    });
  }
  const msg = await figprint('SYNTHETIX-CLI', 'Slant');

  console.log(green(msg));
  console.log(green(`v${packageJson.version}`));

  console.log('\n');
  console.log(gray('Please review this information before you interact with the system:'));
  console.log(
    gray('================================================================================')
  );
  console.log(
    gray(
      `> Provider: ${
        providerUrl
          ? `${providerUrl.slice(0, 25)}${providerUrl.length > 25 ? '...' : ''}`
          : 'Ethers default provider'
      }`
    )
  );
  console.log(gray(`> Network: ${network}`));
  console.log(gray(`> Instance: ${instance}`));
  console.log(gray(`> Gas price: ${gasPrice}`));
  console.log(yellow(`> Target deployment: ${deploymentFilePath}`));

  if (wallet) {
    console.log(yellow(`> Signer: ${wallet.address || wallet}`));
  } else {
    console.log(gray('> Read only'));
  }

  console.log(
    gray('================================================================================')
  );
  console.log('\n');
}

function printCheatsheet({ activeContract, recentContracts, wallet }) {
  console.log(gray.inverse(`${activeContract.name} => ${activeContract.address}`));
  console.log(gray(`  * Signer: ${wallet ? `${wallet.address}` : 'Read only'}`));

  console.log(gray('  * Recent contracts:'));
  for (let i = 0; i < recentContracts.length; i++) {
    const contract = recentContracts[i];
    console.log(gray(`    ${contract.name}: ${contract.address}`));
  }
}

// TODO remove w3utils -> find how to do it with ethers
const toBytes32 = (key) => w3utils.rightPad(w3utils.asciiToHex(key), 64);
// const fromBytes32 = (key) => w3utils.hexToAscii(key);

task(TASK_INTERACT_NAME, TASK_INTERACT_DESC)
  .addOptionalParam('instance', 'Instance of the network', 'official')
  //TODO think about get gasPrice at lower level
  .addOptionalParam('gasPrice', 'Gas price to set when performing transfers', 0, types.int)
  .addOptionalParam('gasLimit', 'Max gas to use when signing transactions', 8000000, types.int)

  .setAction(async function (args, hre) {
    // ------------------
    // Get args (apply defaults)
    // ------------------
    const { instance, gasLimit, gasPrice } = args;
    const network = hre.network.name;

    // ------------------
    // Setup
    // ------------------

    // Derive target build path and retrieve deployment artifacts
    const deploymentFilePath = getDeploymentFilePath({
      artifactsPath: hre.config.cli.artifacts,
      network,
      instance,
      jsonName: ARTIFACTS_JSON_NAME,
    });

    const deploymentData = getDeploymentData({ deploymentFilePath });

    // Determine private/public keys
    let publicKey;
    const privateKey = process.env.PRIVATE_KEY;
    const providerUrl = hre.network.config.url;

    // Construct provider and signer
    const { provider, wallet } = setupProvider({
      providerUrl,
      privateKey,
      publicKey,
    });

    // Set up inquirer
    inquirer.registerPrompt('autocomplete', autocomplete);

    // Set up cache
    const activeContract = {};
    const recentContracts = [];

    // -----------------
    // Start interaction
    // -----------------

    await printHeader({ providerUrl, network, instance, gasPrice, deploymentFilePath, wallet });

    async function pickContract() {
      const targets = Object.keys(deploymentData.targets);

      function prioritizeTarget(itemName) {
        targets.splice(targets.indexOf(itemName), 1);
        targets.unshift(itemName);
      }

      prioritizeTarget('Synthetix');

      async function searchTargets(matches, query = '') {
        matches;

        return new Promise((resolve) => {
          resolve(targets.filter((target) => target.toLowerCase().includes(query.toLowerCase())));
        });
      }

      const { contractName } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'contractName',
          message: 'Pick a CONTRACT:',
          source: (matches, query) => searchTargets(matches, query),
        },
      ]);

      const target = getTarget({
        deploymentData: deploymentData,
        contract: contractName,
      });
      const source = getSource({
        deploymentData: deploymentData,
        contract: target.source,
      });

      // Cheatsheet
      activeContract.name = contractName;
      activeContract.address = target.address;
      if (!recentContracts.some((entry) => entry.name === contractName)) {
        recentContracts.push({ ...activeContract });
      }

      printCheatsheet({ activeContract, recentContracts, wallet });

      const contract = new ethers.Contract(target.address, source.abi, wallet || provider);
      if (source.bytecode === '') {
        const code = await provider.getCode(target.address);
        console.log(red(`  > No code at ${target.address}, code: ${code}`));
      }

      // -----------------
      // Pick a function
      // -----------------

      async function pickFunction() {
        function combineNameAndType(items) {
          const combined = [];
          if (items && items.length > 0) {
            items.map((item) => {
              if (item.name) combined.push(`${item.type} ${item.name}`);
              else combined.push(item.type);
            });
          }

          return combined;
        }

        function reduceSignature(item) {
          const inputs = combineNameAndType(item.inputs);
          const inputPart = `${item.name}(${inputs.join(', ')})`;

          const outputs = combineNameAndType(item.outputs);
          let outputPart = outputs.length > 0 ? ` returns(${outputs.join(', ')})` : '';
          outputPart = item.stateMutability === 'view' ? ` view${outputPart}` : outputPart;

          return `${inputPart}${outputPart}`;
        }

        const escItem = '↩ BACK';

        async function searchAbi(matches, query = '') {
          matches;

          return new Promise((resolve) => {
            let abiMatches = source.abi.filter((item) => {
              if (item.name && item.type === 'function') {
                return item.name.toLowerCase().includes(query.toLowerCase());
              }
              return false;
            });

            // Sort matches by proximity to query
            abiMatches = abiMatches.sort((a, b) => {
              const aProximity = levenshtein(a.name, query);
              const bProximity = levenshtein(b.name, query);
              return aProximity - bProximity;
            });

            const signatures = abiMatches.map((match) => reduceSignature(match));
            if (query === '') {
              signatures.splice(0, 0, escItem);
            }

            resolve(signatures);
          });
        }

        // Prompt function to call
        const prompt = inquirer.prompt([
          {
            type: 'autocomplete',
            name: 'abiItemSignature',
            message: '>>> Pick a FUNCTION:',
            source: (matches, query) => searchAbi(matches, query),
          },
        ]);
        const { abiItemSignature } = await prompt;

        if (abiItemSignature === escItem) {
          prompt.ui.close();

          await pickContract();
          // TODO Add Exit to pickContract
        }

        const abiItemName = abiItemSignature.split('(')[0];
        const abiItem = source.abi.find((item) => item.name === abiItemName);

        // -----------------
        // Process inputs
        // -----------------

        // Prompt inputs for function
        const inputs = [];
        if (abiItem.inputs.length > 0) {
          for (const input of abiItem.inputs) {
            const name = input.name || input.type;

            let message = name;

            const requiresBytes32Util = input.type.includes('bytes32');
            const isArray = input.type.includes('[]');

            if (requiresBytes32Util) {
              message = `${message} (uses toBytes32${
                isArray ? ' - if array, use ["a","b","c"] syntax' : ''
              })`;
            }

            const answer = await inquirer.prompt([
              {
                type: 'input',
                message,
                name,
              },
            ]);

            let processed = answer[name];
            console.log(gray('  > raw inputs:', processed));

            if (isArray) {
              try {
                processed = JSON.parse(processed);
              } catch (err) {
                console.log(red('Error parsing array input. Please use the indicated syntax.'));

                await pickFunction();
              }
            }

            function bytes32ify(value) {
              if (ethers.utils.isHexString(value)) {
                console.log('isHex');
                return value;
              } else {
                return toBytes32(value);
              }
            }
            if (requiresBytes32Util) {
              if (isArray) {
                processed = processed.map((item) => bytes32ify(item));
              } else {
                processed = bytes32ify(processed);
              }
            }

            // Avoid 'false' and '0' being interpreted as bool = true
            function boolify(value) {
              if (value === 'false' || value === '0') return 0;
              return value;
            }
            if (isArray) {
              processed = processed.map((value) => boolify(value));
            } else {
              processed = boolify(processed);
            }
            console.log(
              gray(`  > processed inputs (${isArray ? processed.length : '1'}):`, processed)
            );

            inputs.push(processed);
          }
        }

        // -----------------
        // Call function
        // -----------------

        // Call function
        let result, error;
        // READ ONLY
        if (abiItem.stateMutability === 'view') {
          console.log(gray('  > Querying...'));

          try {
            result = await contract[abiItemName](...inputs);
          } catch (err) {
            error = err;
          }
          // SEND TX
        } else {
          const overrides = {
            gasPrice: ethers.utils.parseUnits(`${gasPrice}`, 'gwei'),
            gasLimit,
          };

          let preview;
          try {
            preview = await contract.populateTransaction[abiItemName](...inputs, overrides);
          } catch (err) {
            console.log(yellow('Warning: tx will probably fail!'));
          }
          if (preview && preview.data) {
            console.log(gray(`  > calldata: ${preview.data}`));
          }

          const { confirmation } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmation',
              message: 'Send transaction?',
            },
          ]);
          if (!confirmation) {
            await pickFunction();

            return;
          }

          console.log(gray(`  > Staging transaction... ${new Date()}`));
          const txPromise = contract[abiItemName](...inputs, overrides);
          result = await sendTx({
            txPromise,
            provider,
          });

          if (result.success) {
            console.log(gray(`  > Sending transaction... ${result.tx.hash}`));
            result = await confirmTx({
              tx: result.tx,
              provider,
            });

            if (result.success) {
              result = result.receipt;
            } else {
              error = result.error;
            }
          } else {
            error = result.error;
          }
        }

        function printReturnedValue(value) {
          if (ethers.BigNumber.isBigNumber(value)) {
            return `${value.toString()} (${ethers.utils.formatEther(value)})`;
          } else if (Array.isArray(value)) {
            return value.map((item) => `${item}`);
          } else {
            return value;
          }
        }

        console.log(gray(`  > Transaction sent... ${new Date()}`));

        if (error) {
          logError(error);
        } else {
          logReceipt(result, contract);

          if (abiItem.stateMutability === 'view' && result !== undefined) {
            if (Array.isArray(result) && result.length === 0) {
              console.log(gray('  ↪ Call returned no data'));
            } else {
              if (abiItem.outputs.length > 1) {
                for (let i = 0; i < abiItem.outputs.length; i++) {
                  const output = abiItem.outputs[i];
                  console.log(
                    cyan(`  ↪${output.name}(${output.type}):`),
                    printReturnedValue(result[i])
                  );
                }
              } else {
                const output = abiItem.outputs[0];
                console.log(cyan(`  ↪${output.name}(${output.type}):`), printReturnedValue(result));
              }
            }
          }
        }

        // Call indefinitely
        await pickFunction();
      }

      // First function pick
      await pickFunction();
    }

    // First contract pick
    await pickContract();
  });
