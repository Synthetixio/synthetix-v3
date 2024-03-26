//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PythStructs, IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";

library PythUtil {
    using DecimalMath for int64;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /// @dev Parse and update `priceUpdateData` relative to min/max publishTimes defined in config.
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

        // NOTE: `unique` fn suffix is important here as it ensures the `prevPublishTime` in `priceUpdateData` is also
        // gt (not gte) `now + minTime`.
        //
        // `parsePrice` also performs an update to store new price if necessary.
        //
        // `parsePriceFeedUpdatesUnique` revert if timestamp is outside the acceptable window (pythPublishTime{Min,Max}).
        PythStructs.PriceFeed[] memory priceFeeds = IPyth(globalConfig.pyth)
            .parsePriceFeedUpdatesUnique{value: msg.value}(
            updateData,
            priceIds,
            commitmentTime.to64() + globalConfig.pythPublishTimeMin,
            commitmentTime.to64() + globalConfig.pythPublishTimeMax
        );

        PythStructs.PriceFeed memory pythData = priceFeeds[0];
        price = getScaledPrice(pythData.price.price, pythData.price.expo);
    }

    /// @dev gets scaled price to 18 decimals. Borrowed from PythNode.sol.
    function getScaledPrice(int64 price, int32 expo) private pure returns (uint256) {
        int256 factor = 18 + expo;
        return
            (factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint()))
                .toUint();
    }
}
