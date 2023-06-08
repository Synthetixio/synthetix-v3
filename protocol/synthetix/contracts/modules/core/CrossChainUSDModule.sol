//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/ICrossChainUSDModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

import "../../storage/CrossChain.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title Module for the cross-chain transfers of stablecoins.
 * @dev See ICrossChainUSDModule.
 */
contract CrossChainUSDModule is ICrossChainUSDModule {
    using CrossChain for CrossChain.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    error InsufficientBalance(uint256 required, uint256 existing);

    uint256 private constant _TRANSFER_GAS_LIMIT = 100000;

    bytes32 internal constant _USD_TOKEN = "USDToken";
    bytes32 internal constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";
    bytes32 internal constant _TRANSFER_CROSS_CHAIN_FEATURE_FLAG = "transferCrossChain";

    /**
     * @inheritdoc ICrossChainUSDModule
     */
    function transferCrossChain(
        uint64 destChainId,
        uint256 amount
    ) external payable returns (uint256 gasTokenUsed) {
        FeatureFlag.ensureAccessToFeature(_TRANSFER_CROSS_CHAIN_FEATURE_FLAG);

        ITokenModule usdToken = AssociatedSystem.load(_USD_TOKEN).asToken();
        usdToken.transferFrom(msg.sender, address(this), amount);
        usdToken.approve(address(CrossChain.load().ccipRouter), amount);

        gasTokenUsed = CrossChain.load().teleport(
            destChainId,
            address(usdToken),
            amount,
            _TRANSFER_GAS_LIMIT
        );
        CrossChain.refundLeftoverGas(gasTokenUsed);

        emit TransferCrossChainInitiated(destChainId, amount, msg.sender);
    }
}
