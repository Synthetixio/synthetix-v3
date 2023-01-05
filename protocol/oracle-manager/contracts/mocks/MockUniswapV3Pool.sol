// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/external/IUniswapV3Pool.sol";

contract MockUniswapV3Pool is IUniswapV3Pool {
    uint256 public liquidity;
    uint256 public tickSize;
    uint256 public secondsPerTick;

    constructor(uint256 _liquidity, uint256 _tickSize, uint256 _secondsPerTick) {
        liquidity = _liquidity;
        tickSize = _tickSize;
        secondsPerTick = _secondsPerTick;
    }

    function observe(
        uint32[] calldata secondsAgos
    )
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        // Initialize variables
        uint256 numTicks = secondsAgos.length;
        tickCumulatives = new int56[](numTicks);
        secondsPerLiquidityCumulativeX128s = new uint160[](numTicks);

        // Generate simulated, realistic values
        for (uint256 i = 0; i < numTicks; i++) {
            tickCumulatives[i] = int56(int(liquidity)) * int56(int(tickSize)) * (int56(int(i)) + 1);
            secondsPerLiquidityCumulativeX128s[i] = uint160(secondsPerTick) * uint128(i + 1);
        }

        return (tickCumulatives, secondsPerLiquidityCumulativeX128s);
    }
}
