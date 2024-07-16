// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/**
 * @title Interface for the PerpsFlashLoanUtil contract.
 * @notice Provides functions for requesting flash loans to close perps V3 positions.
 */
interface IPerpsFlashLoanUtil {
    /**
     * @notice Requests a flash loan.
     * @param _amount The amount of USDC to flash loan.
     * @param _collateralType The address of the collateral type to use.
     * @param _marketId The ID of the market for the flash loan.
     * @param _accountId The account ID to use for the flash loan.
     */
    function requestFlashLoan(
        uint256 _amount,
        address _collateralType,
        uint128 _marketId,
        uint128 _accountId
    ) external;

    /**
     * @notice Executes the flash loan operation.
     * @param asset The address of the asset being flash loaned.
     * @param amount The amount of the asset being flash loaned.
     * @param premium The premium to be paid for the flash loan.
     * @param initiator The address that initiated the flash loan.
     * @param params Additional parameters for the flash loan operation.
     * @return success True if the operation was successful, false otherwise.
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool success);

    /**
     * @notice Sets the Uniswap pool address for a given collateral type.
     * @param _collateralType The address of the collateral type.
     * @param _poolAddress The pool address to be set for the collateral type.
     */
    function setPoolAddress(address _collateralType, address _poolAddress) external;
}
