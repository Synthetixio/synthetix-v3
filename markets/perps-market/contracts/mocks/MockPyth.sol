//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {MockPyth as BaseMockPyth} from "@synthetixio/oracle-manager/contracts/mocks/pyth/MockPyth.sol";

/**
 * @title Module for connecting to other systems.
 * See oracle-manager/../MockPyth
 */
// solhint-disable-next-line no-empty-blocks
contract MockPyth is BaseMockPyth {
    constructor(
        uint _validTimePeriod,
        uint _singleUpdateFeeInWei
    ) BaseMockPyth(_validTimePeriod, _singleUpdateFeeInWei) {}
}
