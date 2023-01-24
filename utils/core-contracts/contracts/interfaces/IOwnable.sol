//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Contract for facilitating ownership by a single address.
 */
interface IOwnable {
    /**
     * @notice Thrown when an address tries to accept ownership but has not been nominated.
     * @param addr The address that is trying to accept ownership.
     */
    error NotNominated(address addr);

    /**
     * @notice Emitted when an address has been nominated.
     * @param newOwner The address that has been nominated.
     */
    event OwnerNominated(address newOwner);

    /**
     * @notice Emitted when the owner of the contract has changed.
     * @param oldOwner The previous owner of the contract.
     * @param newOwner The new owner of the contract.
     */
    event OwnerChanged(address oldOwner, address newOwner);

    /**
     * @notice Allows a nominated address to accept ownership of the contract.
     * @dev Reverts if the caller is not nominated.
     */
    function acceptOwnership() external;

    /**
     * @notice Allows the current owner to nominate a new owner.
     * @dev The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.
     * @param newNominatedOwner The address that is to become nominated.
     */
    function nominateNewOwner(address newNominatedOwner) external;

    /**
     * @notice Allows a nominated owner to reject the nomination.
     */
    function renounceNomination() external;

    /**
     * @notice Returns the current owner of the contract.
     */
    function owner() external view returns (address);

    /**
     * @notice Returns the current nominated owner of the contract.
     * @dev Only one address can be nominated at a time.
     */
    function nominatedOwner() external view returns (address);
}
