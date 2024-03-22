//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IWstETH {
    /**
     * @notice Get amount of stETH for a given amount of wstETH
     * @param _wstETHAmount amount of wstETH
     * @return Amount of stETH for a given wstETH amount
     */
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
}
