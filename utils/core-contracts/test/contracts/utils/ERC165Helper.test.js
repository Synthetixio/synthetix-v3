const { ethers } = hre;
const assert = require('assert/strict');

describe('ERC165Helper', function () {
  let ERC165Helper, ERC20, ERC721;
  let interfaceIdERC20, interfaceIdERC721;

  before('deploy the contracts', async () => {
    let factory;

    factory = await ethers.getContractFactory('ERC165HelperMock');
    ERC165Helper = await factory.deploy();

    factory = await ethers.getContractFactory('ERC20');
    ERC20 = await factory.deploy();

    factory = await ethers.getContractFactory('ERC721');
    ERC721 = await factory.deploy();
  });

  before('calculate the interface ids', async function () {
    interfaceIdERC20 = await ERC165Helper.getERC20InterfaceId();
    interfaceIdERC721 = await ERC165Helper.getERC721InterfaceId();
  });

  it('shows that an ERC20 supports IERC20', async function () {
    assert.ok(await ERC165Helper.supportsInterface(ERC20.address, interfaceIdERC20));
  });

  it('shows that an ERC721 supports IERC721', async function () {
    assert.ok(await ERC165Helper.supportsInterface(ERC721.address, interfaceIdERC721));
  });

  it('shows that an ERC20 does not support IERC721', async function () {
    assert.equal(
      await ERC165Helper.callStatic.supportsInterface(ERC20.address, interfaceIdERC721),
      false
    );
  });

  it('shows that an ERC721 does not support IERC20', async function () {
    assert.equal(
      await ERC165Helper.callStatic.supportsInterface(ERC721.address, interfaceIdERC20),
      false
    );
  });
});
