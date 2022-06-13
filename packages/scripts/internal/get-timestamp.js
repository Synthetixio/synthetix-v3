/**
 * Get the latest `block.timestamp`, using the contract deployed at
 * https://github.com/mjlescano/forks-timestamps
 * This is only necessary Optimism Tenderly Forks, were they have a different
 * `timestamp` value between the last mined block and `block.timestamp`,
 * which was returning `Date.now()`.
 * @param {import('hardhat/config').HardhatRuntimeEnvironment} hre
 */
module.exports = async function getTimestamp(hre) {
  const Timestamp = await hre.ethers.getContractAt(
    [
      {
        inputs: [],
        name: 'getTimestamp',
        outputs: [
          {
            internalType: 'uint256',
            name: '',
            type: 'uint256',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    '0xD81613C160E8Cd4057b47dFB82939A8EdD35889A'
  );

  return (await Timestamp.getTimestamp()).toNumber();
};
