//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Distributor errors used on several places in the system.
 */
interface IDistributorErrors {
    /**
     * @notice Thrown when attempting to use a wrong distributor
     */
    error InvalidDistributor(uint128 id, address distributor);

    /**
     * @notice Thrown when attempting to use a wrong contract as distributor
     */
    error InvalidDistributorContract(address distributor);
}
