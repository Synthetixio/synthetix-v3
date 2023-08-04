//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "./ElectionBase.sol";

/// @dev Provides core schedule functionality. I.e. dates, periods, etc
contract ElectionSchedule is ElectionBase {
    using Council for Council.Data;
    using SafeCastU256 for uint256;

    /// @dev Sets dates within an epoch, with validations
}
