const { ethers } = hre;
const assert = require('assert');
const { signERC2612Permit } = require('eth-permit');

const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

const itBehavesLikeAnERC20 = require('./ERC20.behaviors');

const MOCK_2612 = 'ERC20_2612Mock';

const NAME = 'Synthetix Network Token';
const SYMBOL = 'snx';
const DECIMALS = 18;

// run ERC20 Test Suite
itBehavesLikeAnERC20(MOCK_2612);

describe('ERC20 - EIP2612', () => {
  let ERC20;
  let Handler;

  let holder, spender;

  before('identify signers', async () => {
    [holder, spender] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory(MOCK_2612);
    const factoryHandler = await ethers.getContractFactory('HandlerMock');

    ERC20 = await factory.deploy(NAME, SYMBOL, DECIMALS);
    Handler = await factoryHandler.deploy();
  });

  const holderSupply = ethers.BigNumber.from('1000000');
  const secondHolderSupply = ethers.BigNumber.from('1000000');

  before('mint', async () => {
    const tx = await ERC20.connect(holder).mint(holderSupply);
    const tx2 = await ERC20.connect(holder).mint(secondHolderSupply);
    await Promise.all([tx.wait(), tx2.wait()]);
  });

  const value = 42;
  const maxDeadline = 1734045861;

  const TYPE_HASH = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9';

  function produceDigest(domainSeperator, nonce) {
    const abiCoder = ethers.utils.defaultAbiCoder;
    const getAbiJS = abiCoder.encode(
      ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
      [TYPE_HASH, holder.address, spender.address, value, nonce, maxDeadline]
    );
    const encodedAbiKec = ethers.utils.keccak256(getAbiJS);
    const getPackedJS = `0x1901${domainSeperator.substr(2)}${encodedAbiKec.substr(2)}`;
    const digestProduced = ethers.utils.keccak256(getPackedJS);

    return digestProduced;
  }
  describe('Happy Path', () => {
    it('PERMIT_TYPEHASH has expected value', async () => {
      const permitHash = await ERC20.PERMIT_TYPEHASH();
      assert.equal(permitHash, TYPE_HASH);
    });

    it('Can recreate and match the digest', async () => {
      const domainSeperator = await ERC20.DOMAIN_SEPARATOR();
      const nonce = await ERC20.nonces(holder.address);

      const digest = await ERC20.getDigest(holder.address, spender.address, value, maxDeadline);

      const digestProduced = produceDigest(domainSeperator, nonce);
      assert.equal(digestProduced, digest);
    });

    it('Accepts holder signature and emits Approval event', async () => {
      const { deadline, v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value
      );

      const tx = await ERC20.permit(holder.address, spender.address, value, deadline, v, r, s);
      const receipt = await tx.wait();

      const ownerNonce = await ERC20.nonces(holder.address);
      const allowance = await ERC20.allowance(holder.address, spender.address);
      const event = findEvent({ receipt, eventName: 'Approval' });

      assert.equal(event.args.owner, holder.address);
      assert.equal(event.args.spender, spender.address);
      assert.equal(event.args.amount, value);
      assert.equal(ownerNonce, '1');
      assert.equal(allowance, value);
    });
    it('Allowance gets overwritten', async () => {
      const { deadline, v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value
      );

      await ERC20.permit(holder.address, spender.address, value, deadline, v, r, s);

      const ownerNonce = await ERC20.nonces(holder.address);
      const allowance = await ERC20.allowance(holder.address, spender.address);

      assert.equal(ownerNonce, '2');
      assert.equal(allowance, value);

      const value2 = 666;

      const {
        v: v2,
        r: r2,
        s: s2,
      } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value2
      );

      await ERC20.permit(holder.address, spender.address, value2, deadline, v2, r2, s2);

      const ownerNonce2 = await ERC20.nonces(holder.address);
      const allowance2 = await ERC20.allowance(holder.address, spender.address);

      assert.equal(ownerNonce2, '3');
      assert.equal(allowance2, value2);
    });
    it('Will perform an approval and consume with a single call', async () => {
      const { deadline, v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        Handler.address,
        value
      );

      await Handler.approveAndReceive(
        ERC20.address,
        holder.address,
        Handler.address,
        value,
        deadline,
        v,
        r,
        s
      );

      const ownerNonce = await ERC20.nonces(holder.address);
      const allowance = await ERC20.allowance(holder.address, Handler.address);
      const handlerBalance = await ERC20.balanceOf(Handler.address);

      assert.equal(ownerNonce, '4');
      assert.equal(allowance, 0);
      assert.equal(handlerBalance, value);
    });
  });
  describe('Erroneous cases', () => {
    it('Should not approve a signed message with a different value', async () => {
      const { deadline, v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value
      );

      await assertRevert(
        ERC20.permit(holder.address, spender.address, 100, deadline, v, r, s),
        'INVALID_PERMIT_SIGNATURE'
      );
    });
    it('Should not approve a signed message with an expired deadline', async () => {
      const deadline = 100;
      const { v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value,
        deadline
      );

      await assertRevert(
        ERC20.permit(holder.address, spender.address, value, deadline, v, r, s),
        'PERMIT_DEADLINE_EXPIRED'
      );
    });
    it('Should not approve a signed message with a wrong nonce', async () => {
      const { deadline, v, r, s } = await signERC2612Permit(
        ethers.provider,
        ERC20.address,
        holder.address,
        spender.address,
        value,
        null,
        1
      );

      await assertRevert(
        ERC20.permit(holder.address, spender.address, value, deadline, v, r, s),
        'INVALID_PERMIT_SIGNATURE'
      );
    });
  });
});
