//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";

library OffchainUtil {
    using DecimalMath for int64;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    int256 private constant PRECISION = 18;

    /**
     * @dev parses the result from the offchain lookup data and returns the offchain price plus order and settlementStrategy.
     */
    function parsePythPrice(
        bytes calldata result,
        bytes calldata extraData
    )
        internal
        returns (
            uint256 offchainPrice,
            AsyncOrder.Data storage asyncOrder,
            SettlementStrategy.Data storage settlementStrategy
        )
    {
        uint128 accountId = abi.decode(extraData, (uint128));
        (asyncOrder, settlementStrategy) = AsyncOrder.loadValid(accountId);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier verifier = IPythVerifier(settlementStrategy.priceVerificationContract);
        uint256 msgValue = verifier.getUpdateFee(1);

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msgValue}(
            updateData,
            priceIds,
            asyncOrder.settlementTime.to64(),
            (asyncOrder.settlementTime + settlementStrategy.priceWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();
    }

    /**
     * @dev converts the settlement time into bytes8.
     */
    function getTimeInBytes(uint256 settlementTime) internal pure returns (bytes8) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    /**
     * @dev gets scaled price. Borrowed from PythNode.sol.
     */
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
