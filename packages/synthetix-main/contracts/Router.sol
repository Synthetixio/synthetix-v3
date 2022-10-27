//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

contract Router {
    error UnknownSelector(bytes4 sel);

    address private constant _OWNER_MODULE = 0xda02f6b685725f4661b83fACcA22c11259b460fA;
    address private constant _UPGRADE_MODULE = 0xca41e6C44006C6093fdb19d4e9000034cb5f20eA;
    address private constant _ACCOUNT_MODULE = 0xbA8403ea9784E756c9ee61DeA1143922dE958B77;
    address private constant _ASSIGN_DEBT_MODULE = 0x0c26c0978870193f43656029e1F02A78EcbaA1A8;
    address private constant _ASSOCIATED_SYSTEMS_MODULE = 0x670bff4C6CF9550a92A6847c9b77dA155F3dFeFc;
    address private constant _COLLATERAL_MODULE = 0x0D96133a2f740889E913A967857cE29BBE255a31;
    address private constant _LIQUIDATIONS_MODULE = 0xa4739EEca3Cd9B36ebd8164720E91018124FCd50;
    address private constant _MARKET_COLLATERAL_MODULE = 0x6A2aeBdD74C86F96b9f39CCAb25aD0f3c87b0F09;
    address private constant _MARKET_MANAGER_MODULE = 0xD1e696E7Fbe6871EA6C2DEd979fC6BDd821522d9;
    address private constant _MULTICALL_MODULE = 0x94597307C9549c5BB03d1434dBb2301611ACaaB1;
    address private constant _POOL_CONFIGURATION_MODULE = 0x03C9cE5F0D66BD10c0B6dA40bff2Eb136D0B04cA;
    address private constant _POOL_MODULE = 0xF473aaF2545db1491153a8f67733555cF5858788;
    address private constant _REWARDS_MANAGER_MODULE = 0xbcAe82DABb21E6211d952aFcc2742fd7F4737f88;
    address private constant _UTILS_MODULE = 0xcC1Ae82cf39F67e653500A1BF3D952F3da7422c7;
    address private constant _VAULT_MODULE = 0xB91ac80B781a7a0592f76D503b72240e41685c24;

    fallback() external payable {
        _forward();
    }

    receive() external payable {
        _forward();
    }

    function _forward() internal {
        // Lookup table: Function selector => implementation contract
        bytes4 sig4 = msg.sig;
        address implementation;

        assembly {
            let sig32 := shr(224, sig4)

            function findImplementation(sig) -> result {
                if lt(sig,0x86e3b1cf) {
                    if lt(sig,0x438d61ea) {
                        if lt(sig,0x21a44d58) {
                            if lt(sig,0x1213d453) {
                                switch sig
                                case 0x00cd9ef3 { result := _ACCOUNT_MODULE } // AccountModule.grantPermission()
                                case 0x078145a8 { result := _VAULT_MODULE } // VaultModule.getVaultCollateral()
                                case 0x08cb4b07 { result := _UTILS_MODULE } // UtilsModule.mintInitialSystemToken()
                                case 0x0bae9893 { result := _COLLATERAL_MODULE } // CollateralModule.createLock()
                                case 0x11aa282d { result := _ASSIGN_DEBT_MODULE } // AssignDebtModule.associateDebt()
                                case 0x11e72a43 { result := _POOL_MODULE } // PoolModule.setPoolName()
                                leave
                            }
                            switch sig
                            case 0x1213d453 { result := _ACCOUNT_MODULE } // AccountModule.isAuthorized()
                            case 0x12e1c673 { result := _MARKET_COLLATERAL_MODULE } // MarketCollateralModule.getMaximumMarketCollateral()
                            case 0x150834a3 { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getMarketCollateral()
                            case 0x1627540c { result := _OWNER_MODULE } // OwnerModule.nominateNewOwner()
                            case 0x198f0aa1 { result := _COLLATERAL_MODULE } // CollateralModule.cleanExpiredLocks()
                            leave
                        }
                        if lt(sig,0x34078a01) {
                            switch sig
                            case 0x21a44d58 { result := _REWARDS_MANAGER_MODULE } // RewardsManagerModule.setRewardsDistribution()
                            case 0x2a097162 { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.depositUsd()
                            case 0x2d22bef9 { result := _ASSOCIATED_SYSTEMS_MODULE } // AssociatedSystemsModule.initOrUpgradeNft()
                            case 0x2fb8ff24 { result := _VAULT_MODULE } // VaultModule.getVaultDebt()
                            case 0x3115393d { result := _LIQUIDATIONS_MODULE } // LiquidationsModule.isLiquidatable()
                            case 0x33cc422b { result := _VAULT_MODULE } // VaultModule.getPositionCollateral()
                            leave
                        }
                        switch sig
                        case 0x34078a01 { result := _POOL_MODULE } // PoolModule.setMinLiquidityRatio()
                        case 0x3593bbd2 { result := _VAULT_MODULE } // VaultModule.getPositionDebt()
                        case 0x35eb2824 { result := _OWNER_MODULE } // OwnerModule.isOwnerModuleInitialized()
                        case 0x3659cfe6 { result := _UPGRADE_MODULE } // UpgradeModule.upgradeTo()
                        case 0x3b390b57 { result := _POOL_CONFIGURATION_MODULE } // PoolConfigurationModule.getPreferredPool()
                        leave
                    }
                    if lt(sig,0x6da0c31b) {
                        if lt(sig,0x60988e09) {
                            switch sig
                            case 0x438d61ea { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getMarketIssuance()
                            case 0x47c1c561 { result := _ACCOUNT_MODULE } // AccountModule.renouncePermission()
                            case 0x48741626 { result := _POOL_CONFIGURATION_MODULE } // PoolConfigurationModule.getApprovedPools()
                            case 0x51a40994 { result := _COLLATERAL_MODULE } // CollateralModule.getCollateralPrice()
                            case 0x53a47bb7 { result := _OWNER_MODULE } // OwnerModule.nominatedOwner()
                            case 0x60248c55 { result := _VAULT_MODULE } // VaultModule.getVaultCollateralRatio()
                            leave
                        }
                        switch sig
                        case 0x60988e09 { result := _ASSOCIATED_SYSTEMS_MODULE } // AssociatedSystemsModule.getAssociatedSystem()
                        case 0x6141f7a2 { result := _POOL_MODULE } // PoolModule.nominatePoolOwner()
                        case 0x61525e71 { result := _LIQUIDATIONS_MODULE } // LiquidationsModule.liquidate()
                        case 0x624bd96d { result := _OWNER_MODULE } // OwnerModule.initializeOwnerModule()
                        case 0x691e84bd { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getWithdrawableUsd()
                        leave
                    }
                    if lt(sig,0x7b0532a4) {
                        switch sig
                        case 0x6da0c31b { result := _REWARDS_MANAGER_MODULE } // RewardsManagerModule.claimRewards()
                        case 0x70bed4d5 { result := _POOL_MODULE } // PoolModule.setPoolConfiguration()
                        case 0x718fe928 { result := _OWNER_MODULE } // OwnerModule.renounceNomination()
                        case 0x75bf2444 { result := _COLLATERAL_MODULE } // CollateralModule.getCollateralConfigurations()
                        case 0x79ba5097 { result := _OWNER_MODULE } // OwnerModule.acceptOwnership()
                        leave
                    }
                    switch sig
                    case 0x7b0532a4 { result := _VAULT_MODULE } // VaultModule.delegateCollateral()
                    case 0x7cc14a92 { result := _POOL_MODULE } // PoolModule.renouncePoolOwnership()
                    case 0x7d8a4140 { result := _LIQUIDATIONS_MODULE } // LiquidationsModule.liquidateVault()
                    case 0x7dec8b55 { result := _ACCOUNT_MODULE } // AccountModule.notifyAccountTransfer()
                    case 0x7f2113b3 { result := _COLLATERAL_MODULE } // CollateralModule.withdrawCollateral()
                    leave
                }
                if lt(sig,0xc6f79537) {
                    if lt(sig,0xa4e6306b) {
                        if lt(sig,0x9851af01) {
                            switch sig
                            case 0x86e3b1cf { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getMarketReportedDebt()
                            case 0x8d34166b { result := _ACCOUNT_MODULE } // AccountModule.hasPermission()
                            case 0x8d757bf1 { result := _REWARDS_MANAGER_MODULE } // RewardsManagerModule.getCurrentRewardAccumulation()
                            case 0x8da5cb5b { result := _OWNER_MODULE } // OwnerModule.owner()
                            case 0x927482ff { result := _COLLATERAL_MODULE } // CollateralModule.getAccountAvailableCollateral()
                            case 0x95909ba3 { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getMarketDebtPerShare()
                            leave
                        }
                        switch sig
                        case 0x9851af01 { result := _POOL_MODULE } // PoolModule.getNominatedPoolOwner()
                        case 0x9cbbb824 { result := _COLLATERAL_MODULE } // CollateralModule.configureCollateral()
                        case 0xa0b95fe2 { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.getMarketTotalBalance()
                        case 0xa148bf10 { result := _ACCOUNT_MODULE } // AccountModule.getAccountTokenAddress()
                        case 0xa3aa8b51 { result := _MARKET_COLLATERAL_MODULE } // MarketCollateralModule.withdrawMarketCollateral()
                        leave
                    }
                    if lt(sig,0xac9650d8) {
                        switch sig
                        case 0xa4e6306b { result := _MARKET_COLLATERAL_MODULE } // MarketCollateralModule.depositMarketCollateral()
                        case 0xa7627288 { result := _ACCOUNT_MODULE } // AccountModule.revokePermission()
                        case 0xa796fecd { result := _ACCOUNT_MODULE } // AccountModule.getAccountPermissions()
                        case 0xa79b9ec9 { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.registerMarket()
                        case 0xa937cc4d { result := _REWARDS_MANAGER_MODULE } // RewardsManagerModule.getAvailableRewards()
                        case 0xaaf10f42 { result := _UPGRADE_MODULE } // UpgradeModule.getImplementation()
                        leave
                    }
                    switch sig
                    case 0xac9650d8 { result := _MULTICALL_MODULE } // MulticallModule.multicall()
                    case 0xb790a1ae { result := _POOL_CONFIGURATION_MODULE } // PoolConfigurationModule.addApprovedPool()
                    case 0xbbdd7c5a { result := _POOL_MODULE } // PoolModule.getPoolOwner()
                    case 0xbf60c31d { result := _ACCOUNT_MODULE } // AccountModule.getAccountOwner()
                    case 0xc2b0cf41 { result := _MARKET_COLLATERAL_MODULE } // MarketCollateralModule.getMarketCollateralAmount()
                    leave
                }
                if lt(sig,0xdc0b3f52) {
                    if lt(sig,0xcadb09a5) {
                        switch sig
                        case 0xc6f79537 { result := _ASSOCIATED_SYSTEMS_MODULE } // AssociatedSystemsModule.initOrUpgradeToken()
                        case 0xc707a39f { result := _POOL_MODULE } // PoolModule.acceptPoolOwnership()
                        case 0xc7f62cda { result := _UPGRADE_MODULE } // UpgradeModule.simulateUpgradeTo()
                        case 0xc93f54c1 { result := _COLLATERAL_MODULE } // CollateralModule.depositCollateral()
                        case 0xca5bed77 { result := _POOL_MODULE } // PoolModule.renouncePoolNomination()
                        case 0xcaab529b { result := _POOL_MODULE } // PoolModule.createPool()
                        leave
                    }
                    switch sig
                    case 0xcadb09a5 { result := _ACCOUNT_MODULE } // AccountModule.createAccount()
                    case 0xd245d983 { result := _ASSOCIATED_SYSTEMS_MODULE } // AssociatedSystemsModule.registerUnmanagedSystem()
                    case 0xd3264e43 { result := _VAULT_MODULE } // VaultModule.burnUsd()
                    case 0xd826b04d { result := _MARKET_MANAGER_MODULE } // MarketManagerModule.withdrawUsd()
                    case 0xdbdea94c { result := _MARKET_COLLATERAL_MODULE } // MarketCollateralModule.configureMaximumMarketCollateral()
                    leave
                }
                if lt(sig,0xefecf137) {
                    switch sig
                    case 0xdc0b3f52 { result := _COLLATERAL_MODULE } // CollateralModule.getCollateralConfiguration()
                    case 0xdf16a074 { result := _VAULT_MODULE } // VaultModule.mintUsd()
                    case 0xe1b440d0 { result := _POOL_CONFIGURATION_MODULE } // PoolConfigurationModule.removeApprovedPool()
                    case 0xe7098c0c { result := _POOL_CONFIGURATION_MODULE } // PoolConfigurationModule.setPreferredPool()
                    case 0xef45148e { result := _COLLATERAL_MODULE } // CollateralModule.getAccountCollateral()
                    leave
                }
                switch sig
                case 0xefecf137 { result := _POOL_MODULE } // PoolModule.getPoolConfiguration()
                case 0xf08c9b5f { result := _VAULT_MODULE } // VaultModule.getPositionCollateralizationRatio()
                case 0xf544d66e { result := _VAULT_MODULE } // VaultModule.getPosition()
                case 0xf86e6f91 { result := _POOL_MODULE } // PoolModule.getPoolName()
                case 0xfd85c1f8 { result := _POOL_MODULE } // PoolModule.getMinLiquidityRatio()
                leave
            }

            implementation := findImplementation(sig32)
        }

        if (implementation == address(0)) {
            revert UnknownSelector(sig4);
        }

        // Delegatecall to the implementation contract
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
