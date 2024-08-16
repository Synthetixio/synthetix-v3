import { ethers, BigNumber } from 'ethers';
import { ecsign } from 'ethereumjs-util';

export interface Order {
  accountId: number;
  marketId: BigNumber;
  relayer: string;
  amount: BigNumber;
  price: BigNumber;
  limitOrderMaker: boolean;
  expiration: number;
  nonce: number;
  trackingCode: string;
}

interface OrderCreationArgs {
  accountId: number;
  isShort: boolean;
  isMaker: boolean;
  marketId: BigNumber;
  relayer: string;
  amount: BigNumber;
  price: BigNumber;
  expiration: number;
  nonce: number;
  trackingCode: string;
}

async function getDomain(signer: ethers.Wallet, contractAddress: string): Promise<string> {
  const chainId = await signer.getChainId();

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
          )
        ),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SyntheticPerpetualFutures')),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes('1')),
        chainId,
        contractAddress,
      ]
    )
  );
}

function createLimitOrder(orderArgs: OrderCreationArgs): Order {
  const {
    accountId,
    marketId,
    relayer,
    isShort,
    amount,
    price,
    isMaker,
    expiration,
    nonce,
    trackingCode,
  } = orderArgs;
  return {
    accountId,
    marketId,
    relayer,
    amount: isShort
      ? amount.lt(0)
        ? amount
        : amount.mul(-1)
      : amount.gt(0)
        ? amount
        : amount.mul(-1),
    price,
    limitOrderMaker: isMaker,
    expiration,
    nonce,
    trackingCode,
  };
}

export function createMatchingLimitOrders(orderArgs: OrderCreationArgs): {
  shortOrder: Order;
  longOrder: Order;
} {
  if (orderArgs.amount.lt(0) || orderArgs.isShort) {
    throw new Error('arguments must be for the long position for this method to work');
  }
  const order = createLimitOrder(orderArgs);
  const oppositeOrder = createLimitOrder({
    ...orderArgs,
    isShort: true,
    accountId: orderArgs.accountId - 1,
    isMaker: !orderArgs.isMaker,
  });
  return {
    shortOrder: oppositeOrder,
    longOrder: order,
  };
}

const ORDER_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    'SignedOrderRequest(uint128 accountId,uint128 marketId,address relayer,int128 amount,uint256 price,limitOrderMaker bool,expiration uint256,nonce uint256,trackingCode bytes32)'
  )
);

export async function signOrder(
  order: Order,
  signer: ethers.Wallet,
  contractAddress: string
): Promise<{ v: number; r: Buffer; s: Buffer }> {
  const {
    accountId,
    marketId,
    relayer,
    amount,
    price,
    limitOrderMaker,
    expiration,
    nonce,
    trackingCode,
  } = order;
  const domainSeparator = await getDomain(signer, contractAddress);

  const digest = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        domainSeparator,
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            [
              'bytes32',
              'uint128',
              'uint128',
              'address',
              'int128',
              'uint256',
              'bool',
              'uint256',
              'uint256',
              'bytes32',
            ],
            [
              ORDER_TYPEHASH,
              accountId,
              marketId,
              relayer,
              amount,
              price,
              limitOrderMaker,
              expiration,
              nonce,
              trackingCode,
            ]
          )
        ),
      ]
    )
  );

  return ecsign(
    Buffer.from(digest.slice(2), 'hex'),
    Buffer.from(signer.privateKey.slice(2), 'hex')
  );
}
