//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IWstETH} from "../external/lido/IWstETH.sol";

contract WstETHMock is IWstETH {
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256) {
        return 0;
    }
}
