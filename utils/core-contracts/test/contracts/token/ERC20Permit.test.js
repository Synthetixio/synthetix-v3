const { ethers } = hre;
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');

describe.only('ERC20Permit', () => {
  const totalSupply = ethers.BigNumber.from('1000000');

  let token, vault;

  let user1;

  before('identify signers', async () => {
    [user1] = await ethers.getSigners();
  });

  before('deploy token contract', async () => {
    const factory = await ethers.getContractFactory('ERC20PermitMock');
    token = await factory.deploy();
    const tx = await token.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  before('deploy vault contract', async () => {
    const factory = await ethers.getContractFactory('VaultMock');
    vault = await factory.deploy();
    const tx = await vault.initialize(token.address);
    await tx.wait();
  });

  before('mint token to the user', async () => {
    await token.connect(user1).mint(totalSupply);
  });

  it('depositWithPermit', async () => {
    const amount = 1000;
    const deadline = ethers.constants.MaxUint256;

    const { v, r, s } = await getPermitSignature(user1, token, vault.address, amount, deadline);

    await vault.depositWithPermit(amount, deadline, v, r, s);
    assertBn.equal(await token.balanceOf(vault.address), amount);
  });
});

async function getPermitSignature(signer, token, spender, value, deadline) {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    '1',
    signer.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
}
