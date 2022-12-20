// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./FullMath.sol";
import "./TickMath.sol";

import "../storage/Node.sol";
import "../interfaces/external/IUniswapV3Pool.sol";

library UniswapNodeLibrary {
    function process(bytes memory parameters) internal view returns (Node.Data memory) {
        (address token0, address token1, address pool, uint32 secondsAgo) = abi.decode(
            parameters,
            (address, address, address, uint32)
        );

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        int24 tick = int24(tickCumulativesDelta / int56(uint56(secondsAgo)));

        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int256(uint256(secondsAgo)) != 0)) {
            tick--;
        }

        int256 price = int256(getQuoteAtTick(tick, 1e6, token0, token1));

        return Node.Data(price, 0, 0, 0);
    }

    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
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
}
