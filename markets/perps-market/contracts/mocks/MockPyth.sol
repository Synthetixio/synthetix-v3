//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {MockPyth as BaseMockPyth} from "@synthetixio/oracle-manager/contracts/mocks/pyth/MockPyth.sol";

/**
 * @title Mocked Pyth.
 * See oracle-manager/../MockPyth
 */
contract MockPyth is BaseMockPyth {
    // solhint-disable no-empty-blocks
    constructor(
        uint256 _validTimePeriod,
        uint256 _singleUpdateFeeInWei
    ) BaseMockPyth(_validTimePeriod, _singleUpdateFeeInWei) {}
    // solhint-enable no-empty-blocks
}
