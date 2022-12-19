//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";

// solhint-disable-next-line no-empty-blocks
contract Synth is TokenModule {
    // TODO: Move storage
    uint interestRate;
    uint epochStart;
    uint totalSupplyAtEpochStart;

    // TODO: Use SafeMath

    // DOCS: use existing super.totalSupply() for total shares, super.balanceOf() for account share balance, etc.

    function totalSupply() external view override returns (uint) {
        return super.totalSupply() * tokensPerShare()
    }

    balanceOf() override {
        return super.balanceOf() / super.totalSupply() * totalSupply()
    }

    _mint(address to, uint256 amount) override advanceEpoch {
        uint shareAmount = amount / tokensPerShare();
        super._mint(to, shareAmount);
    }

    _burn(address to, uint256 amount) override advanceEpoch {
        uint shareAmount = amount / tokensPerShare();
        super._burn(to, shareAmount);
    }

`   // DOCS: e.g. Interest Rate: 4%, 1 year has passed, this returns 0.96;
    function tokensPerShare(){
        uint changePerSecond = interestRate / 365 / 24 / 60 / 60;
        return (1 * 10 ** 18) - (totalSupplyAtEpochStart - (block.timestamp - epochStart) * changePerSecond);
    }

    function percentageDecayPerSecond(){
        return interestRate / 365 / 24 / 60 / 60;
    }

    function setInterestRate(uint) advanceEpoch {
        // onlyOwner, advanceEpoch modifier is important here
    }

    // TODO: approve, allowance, etc. convert to shareAmount like mint/burn

    modifier advanceEpoch() {
        _;
        epochStart = block.timestamp;
        totalSupplyAtEpochStart = totalSupply();
    }
}
