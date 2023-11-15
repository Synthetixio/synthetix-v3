//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import "../interfaces/external/IERC7412.sol";
import "../storage/PythERC7412Wrapper.sol";

contract PythERC7412WrapperModule is IERC7412 {
    using DecimalMath for int64;
    using SafeCastI256 for int256;

    error NotSupported(uint8 updateType);

    function setPythAddress(address _pythAddress) external {
        PythERC7412Wrapper.load().pythAddress = _pythAddress;
    }

    function oracleId() external pure returns (bytes32) {
        return bytes32("PYTH");
    }

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int64) {
        PythStructs.Price memory priceData = PythERC7412Wrapper.load().benchmarkPrices[priceId][
            requestedTime
        ];

        if (priceData.price > 0) {
            return priceData.price;
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

    function getLatestPrice(
        bytes32 priceId,
        uint256 stalenessTolerance
    ) external view returns (int64) {
        IPyth pyth = IPyth(PythERC7412Wrapper.load().pythAddress);
        PythStructs.Price memory pythData = pyth.getPriceUnsafe(priceId);

        if (block.timestamp <= stalenessTolerance + pythData.publishTime) {
            return pythData.price;
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
        IPyth pyth = IPyth(PythERC7412Wrapper.load().pythAddress);

        (
            uint8 updateType,
            uint64 timestamp,
            bytes32[] memory priceIds,
            bytes[] memory updateData
        ) = abi.decode(signedOffchainData, (uint8, uint64, bytes32[], bytes[]));

        if (updateType != 2) {
            revert NotSupported(updateType);
        }

        try
            pyth.parsePriceFeedUpdatesUnique{value: msg.value}(
                updateData,
                priceIds,
                timestamp,
                type(uint64).max
            )
        returns (PythStructs.PriceFeed[] memory priceFeeds) {
            for (uint i = 0; i < priceFeeds.length; i++) {
                PythERC7412Wrapper.load().benchmarkPrices[priceIds[i]][timestamp] = priceFeeds[i]
                    .price;
            }
        } catch (bytes memory reason) {
            if (
                reason.length == 4 &&
                reason[0] == 0x02 &&
                reason[1] == 0x5d &&
                reason[2] == 0xbd &&
                reason[3] == 0xd4
            ) {
                revert FeeRequired(pyth.getUpdateFee(updateData));
            } else {
                uint256 len = reason.length;
                assembly {
                    revert(add(reason, 0x20), len)
                }
            }
        }
    }
}
