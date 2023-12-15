//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IWstETH} from "../external/lido/IWstETH.sol";

contract WstETHMock is IWstETH {
    uint256 stETHToWstETHRatio;

    function getStETHByWstETH(uint256) external view returns (uint256) {
        return stETHToWstETHRatio;
    }

    function mockSetstETHToWstETHRatio(uint256 _stETHToWstETHRatio) external {
        stETHToWstETHRatio = _stETHToWstETHRatio;
    }
}
