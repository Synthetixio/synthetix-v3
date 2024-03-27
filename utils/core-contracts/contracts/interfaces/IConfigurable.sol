//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./IOwnable.sol";

/**
 * @title Contract for facilitating ownership by a configurer, meant to be used in tandem with IOwnable.sol.
 */
interface IConfigurable {
    /**
     * @notice Thrown when an address tries to accept ownership of the configurer role but has not been nominated.
     * @param addr The address that is trying to accept ownership.
     */
    error NotNominatedAsConfigurer(address addr);

    /**
     * @notice Emitted when an address has been nominated as configurer.
     * @param newConfigurer The address that has been nominated.
     */
    event ConfigurerNominated(address newConfigurer);

    /**
     * @notice Emitted when the configurer of the contract has changed.
     * @param oldConfigurer The previous configurer of the contract.
     * @param newConfigurer The new configurer of the contract.
     */
    event ConfigurerChanged(address oldConfigurer, address newConfigurer);

    /**
     * @notice Allows a nominated address to accept the configurer role of the contract.
     * @dev Reverts if the caller is not nominated.
     */
    function acceptConfigurerRole() external;

    /**
     * @notice Allows the current owner or configurer to nominate a new configurer.
     * @dev The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.
     * @param newNominatedConfigurer The address that is to become nominated.
     */
    function nominateNewConfigurer(address newNominatedConfigurer) external;

    /**
     * @notice Allows a nominated configurer to reject the nomination.
     */
    function renounceConfigurerNomination() external;

    /**
     * @notice Allows the owner of the contract to set the configurer address.
     */
    function setConfigurer(address newConfigurer) external;

    /**
     * @notice Returns the current configurer of the contract.
     */
    function configurer() external view returns (address);

    /**
     * @notice Returns the current nominated configurer of the contract.
     * @dev Only one address can be nominated at a time.
     */
    function nominatedConfigurer() external view returns (address);
}
