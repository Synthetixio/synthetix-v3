//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpsMarketFactory} from "./PerpsMarketFactory.sol";

/**
 * @title Price storage for a specific synth market.
 */
library PerpsPrice {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        bytes32 feedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }

    function getCurrentPriceData(
        uint128 marketId
    ) internal view returns (NodeOutput.Data memory price) {
        Data storage self = load(marketId);
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        price = INodeModule(factory.oracle).process(self.feedId);
    }

    function getCurrentPrice(uint128 marketId) internal view returns (uint price) {
        return getCurrentPriceData(marketId).price.toUint();
    }

    function update(Data storage self, bytes32 feedId) internal {
        self.feedId = feedId;
    }

    /**
     * @dev Utility function that returns the amount of synth to be received for a given amount of usd.
     * Based on the transaction type, either the buy or sell feed node id is used.
     */
    // function usdSynthExchangeRate(
    //     uint128 marketId,
    //     uint amountUsd,
    //     Transaction.Type transactionType
    // ) internal view returns (uint256 synthAmount) {
    //     uint256 currentPrice = getCurrentPriceData(marketId, transactionType).price.toUint();

    //     synthAmount = amountUsd.divDecimal(currentPrice);
    // }

    // /**
    //  * @dev Utility function that returns the amount of usd to be received for a given amount of synth.
    //  * Based on the transaction type, either the buy or sell feed node id is used.
    //  */
    // function synthUsdExchangeRate(
    //     uint128 marketId,
    //     uint sellAmount,
    //     Transaction.Type transactionType
    // ) internal view returns (uint256 amountUsd) {
    //     uint256 currentPrice = getCurrentPrice(marketId, transactionType);
    //     amountUsd = sellAmount.mulDecimal(currentPrice);
    // }
}
