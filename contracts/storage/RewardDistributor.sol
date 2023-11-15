//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ErrorUtil} from "../utils/ErrorUtil.sol";

library RewardDistributor {
    // --- Storage --- //

    struct Data {
        // keccak of poolId, collateralType, address(rewardDistributorFactory).
        bytes32 id;
        // The pool the distributor will be registered with.
        uint128 poolId;
        // The collateral in the pool to be registered against.
        address collateralType;
        // Name of the distributor to be created e.g, ETHPERP Distributor.
        bytes32 name;
        // The reward ERC20 token this distributor is meant to distribute.
        address token;
    }

    function load(bytes32 id) internal pure returns (Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.RewardDistributor", id));

        assembly {
            d.slot := s
        }
    }

    /**
     * @dev Returns composite key comprised of components that make up a distributor.
     */
    function getRewardId(uint128 poolId, address collateralType, address distributor) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, collateralType, distributor));
    }

    /**
     * @dev Creates an empty distributor in storage at `id`.
     */
    function create(uint128 poolId, address collateralType, bytes32 name, address token) internal returns (bytes32) {
        bytes32 id = getRewardId(poolId, collateralType, address(this));

        RewardDistributor.Data storage distributor = load(id);
        distributor.id = id;
        distributor.poolId = poolId;
        distributor.name = name;
        distributor.token = token;

        return id;
    }
}
