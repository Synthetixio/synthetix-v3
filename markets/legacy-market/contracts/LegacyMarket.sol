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
        _migrate(msg.sender, accountId);
    }

    migateOnBehalf(address migrant, uint accountId) external onlyOwner {
        _migrate(migrant, accountId);
    }

    function _migrate(address migrant, uint accountId) {

        ISynthetix oldSynthetix = IIssuer(this.v2xResolver.getAddress("ProxySynthetix"));

        ISynthetixDebtShare oldDebtShares = IIssuer(this.v2xResolver.getAddress("SynthetixDebtShare"));

        if (oldDebtShares == 0) {
            revert NothingToMigrate();
        }

        uint collateralMigrated = oldSynthetix.balanceOf(migrant);
        uint debtSharesMigrated = oldDebtShares.balanceOf(migrant);

        uint debtSharesValueMigrated = something;

        this.v2xResolver.getAddress("LiquidatorRewards").claim();

        oldSynthetix.transferFrom(migrant, address(this), collateralMigrated);

        oldDebtShares.transferFrom(migrant, address(this), debtSharesMigrated);

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
    }
}
