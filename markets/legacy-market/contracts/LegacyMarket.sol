//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/synthetix-main/contracts/interfaces/external/IMarket.sol";
import "synthetix/contracts/interfaces/IIssuer.sol";

import "./interfaces/IAddressResolver.sol";
import "./interfaces/IIssuer.sol";
import "./interfaces/ISynthetixDebtShare.sol";

contract LegacyMarket is IMarket {
    using MathUtil for uint256;

    uint public marketId;
    bool public pauseStablecoinConversion;
    bool public pauseMigration;

    IAddressResolver public v2xResolver;
    ICoreProxy public v3System;

    error NothingToMigrate();
    error InsufficientCollateralMigrated();

    constructor(address v2xResolver, uint128 v3System) {
        this.v2xResolver = IAddressResolver(v2xResolver);
        this.v3System = ISynthetix(v3System);

        marketId = this.v3System.registerMarket(address(this));
    }

    function balance() public view {
        IIssuer iss = IIssuer(this.v2xResolver.getAddress("Issuer"));

        return iss.debtBalanceOf(address(this), "sUSD");
    }

    function locked() external view {
        return 0;
    }

    convertUSD(uint amount) external {
        require(!pauseStablecoinConversion, "Stablecoin conversion has been paused");
        if (balance() < amount) {
            revert InsufficientCollateralMigrated(amount, balance());
        }

        IERC20 oldUSD = IERC20(this.v2xResolver.getAddress("ProxysUSD"));
        ISynthetix oldSynthetix = IIssuer(this.v2xResolver.getAddress("ProxySynthetix"));

        oldUSD.transferFrom(msg.sender, address(this), amount);
        oldSynthetix.burnSynths(amount);

        v3System.withdraw(msg.sender, amount);
    }

    migrate(uint accountId) external {
        require(!pauseMigration, "Migration has been paused");
        _migrate(msg.sender, accountId);
    }

    migateOnBehalf(address staker, uint accountId) external onlyOwner {
        _migrate(staker, accountId);
    }

    function _migrate(address staker, uint accountId) {

        ISynthetix oldSynthetix = IIssuer(this.v2xResolver.getAddress("ProxySynthetix"));

        ISynthetixDebtShare oldDebtShares = IIssuer(this.v2xResolver.getAddress("SynthetixDebtShare"));

        if (oldDebtShares == 0) {
            revert NothingToMigrate();
        }

        uint collateralMigrated = oldSynthetix.balanceOf(staker);
        uint debtSharesMigrated = oldDebtShares.balanceOf(staker);

        uint debtSharesValueMigrated = something;

        this.v2xResolver.getAddress("LiquidatorRewards").claim();

        oldSynthetix.transferFrom(staker, address(this), collateralMigrated);

        oldDebtShares.transferFrom(staker, address(this), debtSharesMigrated);

        this.v3System.createAccount(accountId);

        this.v3System.depositCollateral(accountId, address(oldSynthetix), collateralMigrated);

        uint preferredPoolId = this.v3System.getPreferredPool();

        this.v3System.delegateCollateral(
            accountId,
            poolId,
            address(oldSynthetix),
            collateralMigrated,
            MathUtil.UNIT
        );

        this.v3System.associateDebt(accountId, poolId, address(oldSynthetix), debtSharesValueMigrated);

        this.v3AccountToken.transfer(staker, accountId);
    }

    function togglePauseStablecoinConversion() external onlyOwner {
        pauseStablecoinConversion = !pauseStablecoinConversion;
    }
    
    function togglePauseMigration() external onlyOwner {
        pauseMigration = !pauseMigration;
    }

}
