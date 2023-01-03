//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "synthetix/contracts/interfaces/IAddressResolver.sol";
import "./IV3CoreProxy.sol";

/**
 * @title Market for the migration of v2x to v3. Acts as a single large "staker" on the v2x system.
 */
interface ILegacyMarket {

    /**
     * @notice Called by anyone with {amount} sUSD to convert {amount} sUSD to {amount} snxUSD.
     The sUSD will be burned (thereby reducing the sUSD total supply and v2x system size), and snxUSD will be minted.
     * Requirements:
     * * User must first approve() the legacy market contract to spend the user's sUSD
     * * LegacyMarket must have already sufficient migrated collateral
     * @param amount the quantity to convert
     */
    function convertUSD(uint amount) external;

    /**
     * @notice Called by an SNX staker on v2x to convert their position to the equivalent on v3. This entails the following broad steps:
     * 1. collect all their SNX collateral and debt from v2x
     * 2. create a new staking account on v3 with the supplied {accountId}
     * 3. put the collateral and debt into this newly created staking account
     * 4. send the created staking account to the msg.sender.
     * @param accountId the new account id that the user wants to have. can be any non-zero integer that is not already occupied.
     */
    function migrate(uint128 accountId) external;

    /**
     * @notice Same as `migrate`, but allows for the owner to forcefully migrate any v2x staker
     * @param accountId the new account id that the user wants to have. can be any non-zero integer that is not already occupied.
     */
    function migrateOnBehalf(address staker, uint128 accountId) external;

    /**
     * called by the owner to register this market with v3. This is an initialization call only.
     */
    function registerMarket() external returns (uint128 newMarketId);

    /**
     * @notice called by the owner to se the addresses of the v3 and v2x systems which are needed for calls in `migrate` and `convertUSD`
     * @param v2xResolverAddress the v2x `AddressResolver` contract address. LegacyMarket can use AddressResolver to get the address of any other v2x contract.
     * @param v3SystemAddress the v3 core proxy address
     */
    function setSystemAddresses(
        IAddressResolver v2xResolverAddress,
        IV3CoreProxy v3SystemAddress
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
