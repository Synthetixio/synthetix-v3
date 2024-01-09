//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {SafeCastU256, SafeCastI256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PythStructs} from "../external/pyth/IPyth.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";

library PythUtil {
    using DecimalMath for int64;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @dev Parse Pyth price for the market pass in through `priceUpdateData`.
     * @notice This function will revert if the price timestamp is outside the acceptable window (pythPublicTime{Min,Max}).
     */
    function parsePythPrice(
        PerpMarketConfiguration.GlobalData storage globalConfig,
        PerpMarketConfiguration.Data storage marketConfig,
        uint256 commitmentTime,
        bytes calldata priceUpdateData
    ) internal returns (uint256 price) {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = marketConfig.pythPriceFeedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = priceUpdateData;

        IPyth pyth = IPyth(globalConfig.pyth);

        // NOTE: `unique` fn suffix is important here as it ensure the prevPublishTime in `priceUpdateData` is also
        // gt (not gte) `now + minTime`.
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdatesUnique{value: msg.value / 2}(
            updateData,
            priceIds,
            commitmentTime.to64() + globalConfig.pythPublishTimeMin,
            commitmentTime.to64() + globalConfig.pythPublishTimeMax
        );

        // NOTE: Adding this temporarily until Pyth add supports for updates to be stored as part of the `parsePriceFeedUpdatesUnique`.
        //
        // However, since this is two separate calls which both require an updateFee, keepers must send 2x. One for the
        // `update` and another for `parse`.
        pyth.updatePriceFeeds{value: msg.value / 2}(updateData);

        PythStructs.PriceFeed memory pythData = priceFeeds[0];
        price = getScaledPrice(pythData.price.price, pythData.price.expo);
    }

    /**
     * @dev gets scaled price to 18 decimals. Borrowed from PythNode.sol.
     */
    function getScaledPrice(int64 price, int32 expo) private pure returns (uint256) {
        int256 factor = 18 + expo;
        return (factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint())).toUint();
    }
}
