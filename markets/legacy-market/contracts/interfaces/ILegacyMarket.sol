//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IAddressResolver.sol";
import "./external/IV3CoreProxy.sol";
import "./ISNXDistributor.sol";

/**
 * @title Market enabling the V3 system to back debt issued by the V2 system, migrate positions from V2 to V3, and convert stablecoins issued from V2 into stablecoins issued by V3.
 * @dev This market effectively acts as a single large "staker" in the V2 system.
 */
interface ILegacyMarket {
    function v2xResolver() external view returns (IAddressResolver);

    function v3System() external view returns (IV3CoreProxy);

    function rewardsDistributor() external view returns (ISNXDistributor);

    /**
     * @notice Emitted after an account has been migrated from the (legacy) v2x system to v3
     * @param staker the address of the v2x staker that migrated
     * @param accountId the new account id
     * @param collateralAmount the amount of SNX migrated to v3
     * @param debtAmount the value of new debt now managed by v3
     */
    event AccountMigrated(
        address indexed staker,
        uint256 indexed accountId,
        uint256 collateralAmount,
        uint256 debtAmount
    );

    /**
     * @notice Emitted if an account was migrated but its c-ratioi was insufficient for assigning debt in v3
     * @param staker the address of the v2x staker that migrated
     * @param collateralAmount the amount of SNX migrated to v3
     * @param debtAmount the value of new debt now managed by v3
     * @param cratio the calculated c-ratio of the account
     */
    event AccountLiquidatedInMigration(
        address staker,
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 cratio
    );

    /**
     * @notice Emitted after a call to `convertUSD`, moving debt from v2x to v3.
     * @param account the address of the address which provided the sUSD for conversion
     * @param amount the amount of sUSD burnt, and the amount of snxUSD minted
     */
    event ConvertedUSD(address indexed account, uint256 amount);

    /**
     * @notice Emitted after a call to `setPauseStablecoinConversion`
     * @param sender the address setting the stablecoin conversion pause status
     * @param paused whether stablecoin conversion is being paused or unpaused
     */
    event PauseStablecoinConversionSet(address indexed sender, bool paused);

    /**
     * @notice Emitted after a call to `setPauseMigration`
     * @param sender the address setting the migration pause status
     * @param paused whether migration is being paused or unpaused
     */
    event PauseMigrationSet(address indexed sender, bool paused);

    /**
     * @notice Called by anyone with {amount} sUSD to convert {amount} sUSD to {amount} snxUSD.
     * The sUSD will be burned (thereby reducing the sUSD total supply and v2x system size), and snxUSD will be minted.
     * Any user who has sUSD can call this function. If you have migrated to v3 and there is insufficient sUSD liquidity
     * to convert, consider buying snxUSD on the open market, since that means most snxUSD has already been migrated.
     * Requirements:
     * * User must first approve() the legacy market contract to spend the user's sUSD
     * * LegacyMarket must have already sufficient migrated collateral
     * @param amount the quantity to convert
     */
    function convertUSD(uint256 amount) external;

    /**
     * @notice Called by an SNX staker on v2x to convert their position to the equivalent on v3. This entails the following broad steps:
     * 1. collect all their SNX collateral and debt from v2x
     * 2. create a new staking account on v3 with the supplied {accountId}
     * 3. put the collateral and debt into this newly created staking account
     * 4. send the created staking account to the ERC2771Context._msgSender().
     * @param accountId the new account id that the user wants to have. can be any non-zero integer that is not already occupied.
     */
    function migrate(uint128 accountId) external;

    /**
     * @notice Same as `migrate`, but allows for the owner to forcefully migrate any v2x staker
     * @param accountId the new account id that the user wants to have. can be any non-zero integer that is not already occupied.
     */
    function migrateOnBehalf(address staker, uint128 accountId) external;

    /**
     * @notice called by the owner to register this market with v3. This is an initialization call only.
     */
    function registerMarket() external returns (uint128 newMarketId);

    /**
     * @notice called by the owner to set the addresses of the v3 and v2x systems which are needed for calls in `migrate` and `convertUSD`
     * @param v2xResolverAddress the v2x `AddressResolver` contract address. LegacyMarket can use AddressResolver to get the address of any other v2x contract.
     * @param v3SystemAddress the v3 core proxy address
     * @param snxDistributor the SNXDistributor which should be used if an account is liquidated
     */
    function setSystemAddresses(
        IAddressResolver v2xResolverAddress,
        IV3CoreProxy v3SystemAddress,
        ISNXDistributor snxDistributor
    ) external returns (bool didInitialize);

    /**
     * @notice called by the owner to disable `convertUSD` (ex. in the case of an emergency)
     * @param paused whether or not `convertUSD` should be disable
     */
    function setPauseStablecoinConversion(bool paused) external;

    /**
     * @notice called by the owner to disable `migrate` (ex. in the case of an emergency)
     * @param paused whether or not `migrate` should be disable
     */
    function setPauseMigration(bool paused) external;
}
