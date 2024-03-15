//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {PerpsRewardDistributor as BasePerpsRewardDistributor} from "@synthetixio/perps-reward-distributor/contracts/PerpsRewardDistributor.sol";

/**
 * @title Mocked PerpsRewardDistributor.
 * See perps-reward-distributor/../PerpsRewardDistributor
 */
contract MockPerpsRewardDistributorV2 is BasePerpsRewardDistributor {
    string private constant _version = "2.0.0";

    function version() external pure virtual override returns (string memory) {
        return _version;
    }
}
