// TODO: Natspec
contract AsyncOrderModule is IAsyncOrderModule {
    using AsyncOrder for AsyncOrder.Data;

    event AsyncBuyOrderCommited(
        uint indexed marketId,
        uint indexed asyncOrderId,
        AsyncOrder asyncOrderData
    );

    error InsufficientSettlementTimeElapsed(); // TODO: add params
    error InsufficientCancellationTimeElapsed(); // TODO: add params

    function commitBuyOrder(
        uint128 marketId,
        uint amountUsd // TODO: add optional priceData to params. How is this handled during settlement?
    ) external override returns (uint asyncOrderId, AsyncOrder memory asyncOrderData) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        // Accept USD
        uint256 allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }
        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);

        // Apply fees
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            msg.sender,
            amountUsd,
            Fee.TradeType.ASYNC_BUY
        );

        // Get estimated exchange amount
        // TODO: use priceData if available?
        uint256 amountSynth = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY
        );

        // Mint synths and hold them in this contract as escrow
        SynthUtil.getToken(marketId).mint(address(this), amountSynth);

        // Issue an async order claim NFT
        asyncOrderId = AsyncOrderClaimUtil.getNft(marketId).mint(msg.sender);

        // Set up order data
        asyncOrderData.orderType = Fee.TradeType.ASYNC_BUY;
        asyncOrderData.blockNumber = block.number;
        asyncOrderData.timestamp = now;
        asyncOrderData.amountProvided = amountUsd;
        asyncOrderData.amountStaged = amountSynth;
        asyncOrderData.feesQuoted = feesQuoted;
        asyncOrderData.orderer = msg.sender;

        // Store order data
        AsyncOrder.create(marketId, asyncOrderId, asyncOrderData);

        // Emit event
        emit AsyncBuyOrderCommited(marketId, asyncOrderId, asyncOrderData);
    }

    function commitSellOrder(
        uint128 marketId,
        uint256 sellAmount // add optional priceData to params
    ) external override returns (uint asyncOrderId, AsyncOrder memory asyncOrderData) {
        // TODO: Sort this out after buy, settle, and cancel
    }

    function settleOrder(
        uint128 marketId,
        uint256 asyncOrderId,
        bytes priceData
    ) external override returns (uint amount) {
        AsyncOrder asyncOrderData = AsyncOrder.load(marketId).asyncOrders[asyncOrderId];

        // Ensure delay has occured
        if (now < asyncOrderData.timestamp + AsyncOrder.load(marketId).minimumOrderAge) {
            revert InsufficientSettlementTimeElapsed();
        }

        // Figure out the actual settlement amount and apply adjustment accordingly.
        if (asyncOrderData.orderType == Fee.TradeType.ASYNC_BUY) {
            uint amountSettled = _disburseBuyOrderEscrow(asyncOrderData, priceData);
        } else if (asyncOrderData.orderType == Fee.TradeType.ASYNC_SELL) {
            uint amountSettled = _disburseSellOrderEscrow(asyncOrderData, priceData);
        }

        // Burn NFT
        AsyncOrderClaimUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        // TODO: Add info about adjustment?
        emit AsyncOrderSettled(marketId, asyncOrderId, asyncOrderData, msg.sender);
    }

    function _disburseBuyOrderEscrow(
        AsyncOrder memory asyncOrderData,
        bytes priceData
    ) private returns (uint finalSynthAmount) {
        // Apply fees (TODO: Recalculate in case amount changed? Using orderer here for fee and not settler)
        (uint256 amountUsable, int256 feesQuoted) = Fee.calculateFees(
            marketId,
            asyncOrderData.orderer,
            asyncOrderData.amountProvided,
            Fee.TradeType.ASYNC_BUY
        );

        // Get final exchange amount
        finalSynthAmount = Price.load(marketId).usdSynthExchangeRate(
            amountUsable,
            Fee.TradeType.ASYNC_BUY,
            priceData // TODO: gotta figure out how this will work
        );

        // Deposit USD
        store.usdToken.approve(address(this), asyncOrderData.amountProvided);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderData.amountProvided
        );

        // Mint additional synths into escrow if necessary
        if (finalSynthAmount > asyncOrderData.amountProvided) {
            SynthUtil.getToken(marketId).mint(
                address(this),
                finalSynthAmount - asyncOrderData.amountProvided
            );
        }

        // Burn additional synths in escrow if necessary
        if (finalSynthAmount < asyncOrderData.amountProvided) {
            SynthUtil.getToken(marketId).burn(
                address(this),
                asyncOrderData.amountProvided - finalSynthAmount
            );
        }

        // Transfer final synth amount to orderer
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            asyncOrderData.orderer,
            finalSynthAmount
        );
    }

    function _disburseSellOrderEscrow(
        AsyncOrder memory asyncOrderData,
        uint256 finalUsdAmount
    ) private {
        // Follow pattern in _disburseBuyOrderEscrow
        //TODO: note amountWithdrawable might be insufficient
    }

    function cancelOrder(uint128 marketId, uint256 asyncOrderId) external override {
        AsyncOrder asyncOrderData = AsyncOrder.load(marketId).asyncOrders[asyncOrderId];

        // Prevent cancellation if this is invoked by someone other than the orderer and the minimum order time plus the external cancellation buffer time hasn't elapsed
        if (
            asyncOrderData.orderer != msg.sender &&
            now <
            asyncOrderData.timestamp +
                AsyncOrder.load(marketId).minimumOrderAge +
                AsyncOrder.load(marketId).externalCancellationBufferTime
        ) {
            revert InsufficientCancellationTimeElapsed();
        }

        // Return escrowed funds
        if (asyncOrderData.orderType == Fee.TradeType.ASYNC_BUY) {
            _returnBuyOrderEscrow(asyncOrderData);
        } else if (asyncOrderData.orderType == Fee.TradeType.ASYNC_SELL) {
            _returnSellOrderEscrow(asyncOrderData);
        }

        // Burn NFT
        AsyncOrderClaimUtil.getNft(marketId).burn(asyncOrderId);

        // Emit event
        emit AsyncOrderCancelled(marketId, asyncOrderId, asyncOrderData, msg.sender);
    }

    function _returnBuyOrderEscrow(AsyncOrder memory asyncOrderData) private {
        // Return the USD provided, minus the quoted fees
        store.usdToken.transferFrom(
            address(this),
            asyncOrderData.orderer,
            asyncOrderData.amountProvided - asyncOrderData.quotedFees
        );

        // Burn the synths escrowed
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderData.amountStaged);

        // Deposit the quoted fees
        store.usdToken.approve(address(this), asyncOrderData.quotedFees);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderData.quotedFees
        );
    }

    function _returnSellOrderEscrow(AsyncOrder memory asyncOrderData) private {
        // Return the synths provided, minus the quoted fees
        SynthUtil.getToken(marketId).transferFrom(
            address(this),
            asyncOrderData.orderer,
            asyncOrderData.amountProvided - asyncOrderData.quotedFees
        );

        // Deposit the escrowed USD
        store.usdToken.approve(address(this), asyncOrderData.amountStaged);
        IMarketManagerModule(store.synthetix).depositMarketUsd(
            marketId,
            address(this),
            asyncOrderData.amountStaged
        );

        // Burn quoted fees of synths
        SynthUtil.getToken(marketId).burn(address(this), asyncOrderData.quotedFees);
    }
}
