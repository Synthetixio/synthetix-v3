import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { ERC20PermitMock, VaultMock } from '../../../typechain-types';

describe('ERC20Permit', function () {
  const totalSupply = BigNumber.from('1000000');

  let token: ERC20PermitMock;
  let vault: VaultMock;

  let user1: ethers.VoidSigner;

  before('identify signers', async function () {
    [user1] = (await hre.ethers.getSigners()) as unknown as ethers.VoidSigner[];
  });

  before('deploy token contract', async function () {
    const factory = await hre.ethers.getContractFactory('ERC20PermitMock');
    token = await factory.deploy();
    const tx = await token.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  before('deploy vault contract', async function () {
    const factory = await hre.ethers.getContractFactory('VaultMock');
    vault = await factory.deploy();
    const tx = await vault.initialize(token.address);
    await tx.wait();
  });

  before('mint token to the user', async function () {
    await token.connect(user1).mint(totalSupply);
  });

  it('depositWithPermit', async function () {
    const amount = 1000;
    const deadline = ethers.constants.MaxUint256;

    const { v, r, s } = await getPermitSignature(user1, token, vault.address, amount, deadline);

    await vault.depositWithPermit(amount, deadline, v, r, s);
    assertBn.equal(await token.balanceOf(vault.address), amount);
  });
});

async function getPermitSignature(
  signer: ethers.VoidSigner,
  token: ERC20PermitMock,
  spender: string,
  value: number,
  deadline: BigNumber
) {
  const signerAddress = await signer.getAddress();
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signerAddress),
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
        owner: signerAddress,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
}
