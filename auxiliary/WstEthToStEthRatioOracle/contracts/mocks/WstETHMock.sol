//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWstETH} from "../interfaces/IWstETH.sol";

contract WstETHMock is IWstETH {
    uint256 wstEthToStEthRatio;

    function getStETHByWstETH(uint256) external view returns (uint256) {
        return wstEthToStEthRatio;
    }

    function mockSetWstEthToStEthRatio(uint256 _wstEthToStEthRatio) external {
        wstEthToStEthRatio = _wstEthToStEthRatio;
    }
}
