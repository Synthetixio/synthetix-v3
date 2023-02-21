//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/**
 * @title Module wrapping an ERC20 token implementation.
 * @notice the contract uses A = P(1 + r/n)**nt formula compounded every second to calculate decay amount at any moment
 */
interface IDecayTokenModule is IERC20 {
    /**
     * @notice Returns wether the token has been initialized.
     * @return A boolean with the result of the query.
     */
    function isInitialized() external returns (bool);

    /**
     * @notice Initializes the token with name, symbol, and decimals.
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) external;

    /**
     * @notice Allows the owner to mint tokens.
     * @param to The address to receive the newly minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Allows the owner to burn tokens.
     * @param to The address whose tokens will be burnt.
     * @param amount The amount of tokens to burn.
     */
    function burn(address to, uint256 amount) external;

    /**
     * @notice Allows an address that holds tokens to provide allowance to another.
     * @param from The address that is providing allowance.
     * @param spender The address that is given allowance.
     * @param amount The amount of shares as allowance being given.
     */
    function setAllowance(address from, address spender, uint256 amount) external;

    /**
     * @notice Updates the decay rate for a year
     * @param _rate The decay rate with 18 decimals (1e16 means 1% decay per year).
     */
    function setDecayRate(uint256 _rate) external;

    /**
     * @notice get decay rate for a year
     */
    function decayRate() external returns (uint256);

    /**
     * @notice advance epoch manually in order to avoid precision loss
     */
    function advanceEpoch() external returns (uint256);
}
