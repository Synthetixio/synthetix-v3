import { findEvent, findSingleEvent } from '@synthetixio/core-utils/src/utils/ethers/events';
import { ethers } from 'ethers';
import { CcipRouterMock__factory } from '../../typechain-types/factories/contracts/mocks/CcipRouterMock__factory';

import type { CcipRouterMock } from '../../typechain-types/contracts/mocks/CcipRouterMock';

export const CcipRouter = new ethers.Contract(
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
  index,
}: {
  rx: ethers.ContractReceipt;
  sourceChainSelector: ethers.BigNumberish;
  targetSigner: ethers.Signer;
  ccipAddress: string;
  index?: number;
}) {
  let evt;
  if (typeof index !== 'number') {
    evt = findSingleEvent({
      eventName: 'CCIPSend',
      receipt: rx,
      contract: CcipRouter,
    });
  } else {
    evt = findEvent({
      eventName: 'CCIPSend',
      receipt: rx,
      contract: CcipRouter,
    } as Parameters<typeof findEvent>[0]);
    evt = Array.isArray(evt) ? evt[index] : evt;
  }

  if (evt && evt.args) {
    const message = {
      messageId: evt.args.messageId,
      sourceChainSelector,
      sender: ethers.utils.defaultAbiCoder.encode(['address'], [rx.to]),
      data: evt.args.message.data,
      tokenAmounts: [],
    };

    return CcipRouter.attach(ccipAddress)
      .connect(targetSigner)
      .__ccipReceive(rx.to, message, { value: 0 });
  } else {
    throw new Error('no CCIPSend event found');
  }
}
