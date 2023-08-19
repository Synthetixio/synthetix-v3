//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IPerpsMarketFactoryModule} from "../interfaces/IPerpsMarketFactoryModule.sol";

/**
 * @title Module for connecting to PerpsMarket and use views as txn.
 */
contract MockGasProfiler {
    // PerpsV3 SuperMarket
    IPerpsMarketFactoryModule perpsMarketFactory;
    uint256 public gasUsed;

    function setPerpsMarketFactory(IPerpsMarketFactoryModule _perpsMarketFactory) external {
        perpsMarketFactory = _perpsMarketFactory;
    }

    function getPerpsMarketFactory() external view returns (IPerpsMarketFactoryModule) {
        return perpsMarketFactory;
    }

    function txReportedDebt(uint128 perpsMarketId) external {
        uint previousGas = gasleft();
        perpsMarketFactory.reportedDebt(perpsMarketId);
        gasUsed = previousGas - gasleft();
    }

    function txMinimumCredit(uint128 perpsMarketId) external {
        uint previousGas = gasleft();
        perpsMarketFactory.minimumCredit(perpsMarketId);
        gasUsed = previousGas - gasleft();
    }
}
