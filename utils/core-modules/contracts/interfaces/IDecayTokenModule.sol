//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./ITokenModule.sol";

/**
 * @title Module wrapping an ERC20 token implementation.
 * @notice the contract uses A = P(1 + r/n)**nt formula compounded every second to calculate decay amount at any moment
 */
interface IDecayTokenModule is ITokenModule {
    /**
     * @notice Emitted when the decay rate is set to a value higher than the maximum
     */
    error InvalidDecayRate();

    /**
     * @notice Updates the decay rate for a year
     * @param _rate The decay rate with 18 decimals (1e16 means 1% decay per year).
     */
    function setDecayRate(uint256 _rate) external;

    /**
     * @notice get decay rate for a year
     */
    function decayRate() external view returns (uint256);

    /**
     * @notice advance epoch manually in order to avoid precision loss
     */
    function advanceEpoch() external returns (uint256);
}
