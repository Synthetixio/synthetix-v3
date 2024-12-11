// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ForkDetector} from "@synthetixio/core-contracts/contracts/utils/ForkDetector.sol";
import {PythStructs, IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {IERC7412} from "./interfaces/IERC7412.sol";
import {Price} from "./storage/Price.sol";

contract PythERC7412Wrapper is IERC7412 {
    using DecimalMath for int64;
    using SafeCastI256 for int256;

    event ForkBenchmarkPriceSet(bytes32 priceId, uint64 requestedTime, int256 newPrice, int32 expo);
    event ForkLatestPriceSet(bytes32 priceId, int256 newPrice);

    int256 private constant PRECISION = 18;

    error NotSupported(uint8 updateType);

    address public immutable pythAddress;

    // NOTE: this value is only settable on a fork
    mapping(bytes32 => int256) overridePrices;

    constructor(address _pythAddress) {
        pythAddress = _pythAddress;
    }

    function oracleId() external pure returns (bytes32) {
        return bytes32("PYTH");
    }

    function setBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime,
        int256 newPrice,
        int32 expo
    ) external {
        ForkDetector.requireFork();

        // solhint-disable-next-line numcast/safe-cast
        Price.load(priceId).benchmarkPrices[requestedTime].price = int64(newPrice);
        Price.load(priceId).benchmarkPrices[requestedTime].expo = expo;

        emit ForkBenchmarkPriceSet(priceId, requestedTime, newPrice, expo);
    }

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int256) {
        PythStructs.Price memory priceData = Price.load(priceId).benchmarkPrices[requestedTime];

        if (priceData.price > 0) {
            return _getScaledPrice(priceData.price, priceData.expo);
        }

        if (ForkDetector.isDevFork() && priceData.price == 0) {
            // Return whatever the latest available price is on chain to avoid difficult errors
            // if price is set negative then oracle data required will still  be returned
            IPyth pyth = IPyth(pythAddress);
            PythStructs.Price memory pythData = pyth.getPriceUnsafe(priceId);
            return _getScaledPrice(pythData.price, pythData.expo);
        }

        revert OracleDataRequired(
            // solhint-disable-next-line numcast/safe-cast
            address(this),
            abi.encode(
                // solhint-disable-next-line numcast/safe-cast
                uint8(2), // PythQuery::Benchmark tag
                // solhint-disable-next-line numcast/safe-cast
                uint64(requestedTime),
                [priceId]
            )
        );
    }

    function setLatestPrice(bytes32 priceId, int256 newPrice) external {
        ForkDetector.requireFork();

        overridePrices[priceId] = newPrice;

        emit ForkLatestPriceSet(priceId, newPrice);
    }

    function getLatestPrice(
        bytes32 priceId,
        uint256 stalenessTolerance
    ) external view returns (int256) {
        bool isFork = ForkDetector.isDevFork();
        if (isFork && overridePrices[priceId] != 0) {
            return overridePrices[priceId];
        }

        IPyth pyth = IPyth(pythAddress);
        PythStructs.Price memory pythData = pyth.getPriceUnsafe(priceId);

        if (isFork || block.timestamp <= stalenessTolerance + pythData.publishTime) {
            return _getScaledPrice(pythData.price, pythData.expo);
        }

        //price too stale
        revert OracleDataRequired(
            address(this),
            abi.encode(
                // solhint-disable-next-line numcast/safe-cast
                uint8(1),
                // solhint-disable-next-line numcast/safe-cast
                uint64(stalenessTolerance),
                [priceId]
            )
        );
    }

    function fulfillOracleQuery(bytes memory signedOffchainData) external payable {
        IPyth pyth = IPyth(pythAddress);

        uint8 updateType = abi.decode(signedOffchainData, (uint8));

        if (updateType == 1) {
            (
                ,
                ,
                ,
                /* uint8 _updateType */
                /*uint64 stalenessTolerance*/ /* bytes32[] memory priceIds */ bytes[]
                    memory updateData
            ) = abi.decode(signedOffchainData, (uint8, uint64, bytes32[], bytes[]));

            try pyth.updatePriceFeeds{value: msg.value}(updateData) {} catch (bytes memory reason) {
                if (_isFeeRequired(reason)) {
                    revert FeeRequired(pyth.getUpdateFee(updateData));
                } else {
                    uint256 len = reason.length;
                    assembly {
                        revert(add(reason, 0x20), len)
                    }
                }
            }
        } else if (updateType == 2) {
            (
                ,
                /* uint8 _updateType */
                uint64 timestamp,
                bytes32[] memory priceIds,
                bytes[] memory updateData
            ) = abi.decode(signedOffchainData, (uint8, uint64, bytes32[], bytes[]));

            try
                pyth.parsePriceFeedUpdatesUnique{value: msg.value}(
                    updateData,
                    priceIds,
                    timestamp,
                    type(uint64).max
                )
            returns (PythStructs.PriceFeed[] memory priceFeeds) {
                for (uint256 i = 0; i < priceFeeds.length; i++) {
                    Price.load(priceIds[i]).benchmarkPrices[timestamp] = priceFeeds[i].price;
                }
            } catch (bytes memory reason) {
                if (_isFeeRequired(reason)) {
                    revert FeeRequired(pyth.getUpdateFee(updateData));
                } else {
                    uint256 len = reason.length;
                    assembly {
                        revert(add(reason, 0x20), len)
                    }
                }
            }
        } else {
            revert NotSupported(updateType);
        }
    }

    function _isFeeRequired(bytes memory reason) private pure returns (bool) {
        return
            reason.length == 4 &&
            reason[0] == 0x02 &&
            reason[1] == 0x5d &&
            reason[2] == 0xbd &&
            reason[3] == 0xd4;
    }

    /**
     * @dev gets scaled price. Borrowed from PythNode.sol.
     */
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
