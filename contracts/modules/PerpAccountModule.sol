//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpMarketFactoryConfiguration} from "../storage/PerpMarketFactoryConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpAccount} from "../storage/PerpAccount.sol";
import {Order} from "../storage/Order.sol";
import {PerpErrors} from "../storage/PerpErrors.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using PerpAccount for PerpAccount.Data;
    using PerpMarket for PerpMarket.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @inheritdoc IPerpAccountModule
     */
    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest) {}
}
