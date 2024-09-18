// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../utils/FullMath.sol";
import "../utils/TickMath.sol";

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";
import "../interfaces/external/IUniswapV3Pool.sol";

library UniswapNode {
    using SafeCastU256 for uint256;
    using SafeCastU160 for uint160;
    using SafeCastU56 for uint56;
    using SafeCastU32 for uint32;
    using SafeCastI56 for int56;
    using SafeCastI256 for int256;

    using DecimalMath for int256;

    uint8 public constant PRECISION = 18;

    function process(
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory nodeOutput) {
        (
            address token,
            address stablecoin,
            uint8 decimalsToken,
            uint8 decimalsStablecoin,
            address pool,
            uint32 secondsAgo
        ) = abi.decode(parameters, (address, address, uint8, uint8, address, uint32));

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        int24 tick = (tickCumulativesDelta / secondsAgo.to56().toInt()).to24();

        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo.to256().toInt() != 0)) {
            tick--;
        }

        uint256 baseAmount = 10 ** PRECISION;
        int256 price = getQuoteAtTick(tick, baseAmount, token, stablecoin).toInt();

        // solhint-disable-next-line numcast/safe-cast
        int256 scale = uint256(decimalsToken).toInt() - uint256(decimalsStablecoin).toInt();

        int256 finalPrice = scale > 0
            ? price.upscale(scale.toUint())
            : price.downscale((-scale).toUint());

        return NodeOutput.Data(finalPrice, block.timestamp, 0, 0);
    }

    function getQuoteAtTick(
        int24 tick,
        uint256 baseAmount,
        address baseToken,
        address quoteToken
    ) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = sqrtRatioX96.to256() * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal view returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 192) {
            return false;
        }

        (
            address token,
            address stablecoin,
            uint8 decimalsToken,
            uint8 decimalsStablecoin,
            address pool,
            uint32 secondsAgo
        ) = abi.decode(
                nodeDefinition.parameters,
                (address, address, uint8, uint8, address, uint32)
            );

        if (IERC20(token).decimals() != decimalsToken) {
            return false;
        }

        if (IERC20(stablecoin).decimals() != decimalsStablecoin) {
            return false;
        }

        address poolToken0 = IUniswapV3Pool(pool).token0();
        address poolToken1 = IUniswapV3Pool(pool).token1();

        if (
            !(poolToken0 == token && poolToken1 == stablecoin) &&
            !(poolToken0 == stablecoin && poolToken1 == token)
        ) {
            return false;
        }

        if (decimalsToken > 18 || decimalsStablecoin > 18) {
            return false;
        }

        if (secondsAgo == 0) {
            return false;
        }

        // Must call relevant function without error
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;
        IUniswapV3Pool(pool).observe(secondsAgos);

        return true;
    }
}
