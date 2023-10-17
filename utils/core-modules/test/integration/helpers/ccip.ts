import { findSingleEvent } from '@synthetixio/core-utils/src/utils/ethers/events';
import { ethers } from 'ethers';
import { CcipRouterMock__factory } from '../../../typechain-types/factories/contracts/mocks/CcipRouterMock__factory';

import type { CcipRouterMock } from '../../../typechain-types/contracts/mocks/CcipRouterMock';

const CcipRouter = new ethers.Contract(
  ethers.constants.AddressZero,
  CcipRouterMock__factory.abi
) as CcipRouterMock;

/**
 * Given a receipt from a transaction that called the ccipSend method from CcipRouterMock
 */
export async function ccipReceive({
  rx,
  sourceChainSelector,
  targetSigner,
  ccipAddress,
}: {
  rx: ethers.ContractReceipt;
  sourceChainSelector: ethers.BigNumberish;
  targetSigner: ethers.Signer;
  ccipAddress: string;
}) {
  const evt = findSingleEvent({
    eventName: 'CCIPSend',
    receipt: rx,
    contract: CcipRouter,
  });

  const message = {
    messageId: evt.args.messageId,
    sourceChainSelector,
    sender: rx.to,
    data: evt.args.message.data,
    tokenAmounts: [],
  };

  const tx = await CcipRouter.attach(ccipAddress)
    .connect(targetSigner)
    .__ccipReceive(rx.to, message, { value: 0 });

  await tx.wait();
  return tx;
}
