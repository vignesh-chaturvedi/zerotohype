// The terms on /glossary/. Each definition agrees with the lesson or docs page it links to; where a
// lesson covers a term, the lesson's wording (checked against the live API) is the source.

export type Term = {
  term: string;
  /** Other names it goes by. They're shown under the term, and search finds the term by them. */
  aka?: string[];
  /** One to three sentences, in inline Markdown. */
  def: string;
  /** Where it's explained properly: a lesson section, another page here, or the docs. */
  see?: [label: string, href: string][];
};

const D = "https://hyperliquid.gitbook.io/hyperliquid-docs";
const T1 = "/tracks/t01-orientation/";
const T2 = "/tracks/t02-reading-the-exchange/";
const T3 = "/tracks/t03-signing-and-sending/";
const T4 = "/tracks/t04-trading-mechanics/";
const T7 = "/tracks/t07-running-a-perp-dex/";
const T8 = "/tracks/t08-outcome-markets/";

export const terms: Term[] = [
  {
    term: "Activation fee",
    def: "The first transfer into a brand-new HyperCore account costs 1 of the quote token, such as 1 USDC, whatever asset is sent. An account that was never activated can't send CoreWriter actions from the HyperEVM.",
    see: [["T3 · New accounts pay to activate", `${T3}#new-accounts-pay-to-activate`]],
  },
  { term: "Agent wallet", def: "Another name for an [API wallet](#api-wallet)." },
  {
    term: "ALO", aka: ["Add liquidity only", "Post-only"],
    def: "A [time in force](#time-in-force) for limit orders: the order is cancelled rather than matching at once, so it only ever adds liquidity. Batches made only of ALO orders get priority from validators.",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`], ["T1 · Nonces work differently", `${T1}#nonces-work-differently`]],
  },
  {
    term: "API wallet", aka: ["Agent wallet"],
    def: "A separate key that an account approves to sign for it or its sub-accounts. It can trade but not withdraw, and holds nothing itself: to read an account, ask about the account's address, not the API wallet's.",
    see: [["T1 · Your account and its API wallets", `${T1}#your-account-and-its-api-wallets`]],
  },
  {
    term: "Asset ID",
    def: "The number an order uses for its market. A perp on the main DEX uses its index in `meta`, a spot pair `10000 +` its index in `spotMeta`, and HIP-3 perps and outcome sides have ranges of their own.",
    see: [["T2 · Every market type names its assets differently", `${T2}#every-market-type-names-its-assets-differently`]],
  },
  {
    term: "Auto-deleveraging", aka: ["ADL"],
    def: "The last step of a liquidation. If an account's value still goes negative, positions on the other side are closed in order of unrealized pnl and leverage, which keeps the exchange solvent.",
    see: [["T4 · Liquidations", `${T4}#liquidations`]],
  },
  {
    term: "Backstop liquidator",
    def: "Takes over a position once its account falls below two-thirds of its maintenance margin. On the main DEX it's the liquidator vault, part of [HLP](#hlp); each HIP-3 DEX has its own, for cross-margin assets only.",
    see: [["T4 · Liquidations", `${T4}#liquidations`], ["T7 · Cross margin and the backstop", `${T7}#cross-margin-and-the-backstop`]],
  },
  {
    term: "BBO", aka: ["Best bid and offer"],
    def: "The highest bid and the lowest ask on a book. The `bbo` WebSocket feed streams it, and a rejected post-only order's error quotes it.",
    see: [["T2 · Stream instead of polling", `${T2}#stream-instead-of-polling`], ["API errors · BadAloPx", "/errors/#bad-alo-px"]],
  },
  {
    term: "Builder code", aka: ["Builder fee"],
    def: "Lets an app take a fee on the orders it sends for users. Each user approves a maximum fee for each builder and can revoke it, and the app sets the fee on each order.",
    see: [["T5 · Building on order flow", "/tracks/t05-building-on-order-flow/"], ["Docs · Builder codes", `${D}/trading/builder-codes`]],
  },
  {
    term: "cloid", aka: ["Client order ID"],
    def: "An optional 128-bit hex string you give an order, so you can cancel it or look it up without waiting for its [oid](#oid).",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`]],
  },
  {
    term: "CoreWriter",
    def: "The system contract at `0x3333…3333` that HyperEVM contracts call to send actions to HyperCore, such as orders, transfers and staking. Orders and vault transfers sent through it are delayed on-chain for a few seconds.",
    see: [["T9 · HyperEVM", "/tracks/t09-hyperevm/"], ["Docs · Interacting with HyperCore", `${D}/for-developers/hyperevm/interacting-with-hypercore`]],
  },
  {
    term: "Cross margin",
    def: "The default margin mode: all cross positions share the account's collateral, and the account's value as a whole decides when it's liquidated. On a HIP-3 DEX, turning cross margin on for an asset can't be undone.",
    see: [["T4 · Margin", `${T4}#margin`], ["T7 · Cross margin and the backstop", `${T7}#cross-margin-and-the-backstop`]],
  },
  {
    term: "Dead man's switch", aka: ["scheduleCancel"],
    def: "`scheduleCancel` cancels all your open orders at a time you set. Send it again to change the time, or without a time to remove it. The time must be at least 5 seconds ahead, and it can fire at most 10 times a day.",
    see: [["Docs · Exchange endpoint", `${D}/for-developers/api/exchange-endpoint`]],
  },
  {
    term: "Deployer",
    def: "The account that runs a HIP-3 perp DEX or a HIP-4 outcome venue. It stakes HYPE, sends the deploy actions, and can hand single actions to [sub-deployers](#sub-deployer).",
    see: [["T7 · What a deployer signs up for", `${T7}#what-a-deployer-signs-up-for`], ["T8 · Running a venue", `${T8}#running-a-venue`]],
  },
  {
    term: "expiresAfter",
    def: "An optional timestamp, in milliseconds, after which an L1 action is rejected. User-signed actions don't support it.",
    see: [["T3 · Two signing schemes", `${T3}#two-signing-schemes`]],
  },
  {
    term: "Funding", aka: ["Funding rate"],
    def: "Hourly payments between longs and shorts that pull the perp's price toward the oracle's. Each hour pays an eighth of an 8-hour rate, made of the average [premium](#premium) and an interest rate of 0.01% per 8 hours, and capped at 4% an hour.",
    see: [["T4 · Funding, worked through", `${T4}#funding-worked-through`], ["Lab · Funding and mark price", "/labs/funding/"]],
  },
  {
    term: "GTC", aka: ["Good till cancelled"],
    def: "A [time in force](#time-in-force) for limit orders: the order rests on the book until it fills or is cancelled.",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`]],
  },
  {
    term: "HIP-1",
    def: "Hyperliquid's native token standard, for spot tokens on HyperCore: a capped supply set at genesis, with deployments sold by a gas auction.",
    see: [["T6 · Launching assets", "/tracks/t06-launching-assets/"], ["Docs · HIP-1", `${D}/hyperliquid-improvement-proposals-hips/hip-1-native-token-standard`]],
  },
  {
    term: "HIP-2", aka: ["Hyperliquidity"],
    def: "Hyperliquidity: a strategy inspired by Uniswap but quoting on the order book, which gives a new HIP-1 token liquidity while its price is found.",
    see: [["T6 · Launching assets", "/tracks/t06-launching-assets/"], ["Docs · HIP-2", `${D}/hyperliquid-improvement-proposals-hips/hip-2-hyperliquidity`]],
  },
  {
    term: "HIP-3", aka: ["Builder-deployed perps"],
    def: "Builder-deployed perps: anyone who stakes 500k HYPE can run a [perp DEX](#perp-dex) on HyperCore's order books and margining.",
    see: [["T7 · Running a perp DEX", T7]],
  },
  {
    term: "HIP-4", aka: ["Outcome markets"],
    def: "Outcome markets: fully collateralised contracts that settle within a fixed range, which venues deploy from templates that validators approve.",
    see: [["T8 · Outcome markets", T8]],
  },
  {
    term: "HLP", aka: ["Hyperliquidity Provider"],
    def: "Hyperliquidity Provider, a community-owned protocol vault. It makes markets, performs liquidations and earns a share of trading fees. Deposits are locked for 4 days.",
    see: [["Docs · Protocol vaults", `${D}/hypercore/vaults/protocol-vaults`]],
  },
  {
    term: "HyperBFT",
    def: "Hyperliquid's consensus, a variant of HotStuff tuned for end-to-end latency. Validators produce blocks in proportion to the HYPE staked to them.",
    see: [["Docs · HyperCore overview", `${D}/hypercore/overview`]],
  },
  {
    term: "HyperCore",
    def: "The exchange half of Hyperliquid: order books, margin, matching, funding and liquidations, all on-chain. You reach it over HTTP and WebSocket.",
    see: [["T1 · Two halves, one chain", `${T1}#two-halves-one-chain`]],
  },
  {
    term: "HyperEVM",
    def: "The EVM half of Hyperliquid, with HYPE as gas, whose blocks are built in the same execution as HyperCore's. Its chain ID is 999 on mainnet and 998 on testnet.",
    see: [["T1 · Two halves, one chain", `${T1}#two-halves-one-chain`], ["T9 · HyperEVM", "/tracks/t09-hyperevm/"]],
  },
  {
    term: "HYPE",
    def: "Hyperliquid's native token: gas on the HyperEVM, staked to validators, and staked by HIP-3 deployers.",
    see: [["T1 · Two halves, one chain", `${T1}#two-halves-one-chain`]],
  },
  {
    term: "Impact price",
    def: "The average fill price for a set notional size on one side of the book. [Funding](#funding)'s premium compares the impact bid and ask with the oracle price.",
    see: [["T4 · Funding, worked through", `${T4}#funding-worked-through`]],
  },
  {
    term: "Initial margin",
    def: "What it takes to open a position: size × mark price / leverage. Leverage is only checked when the position opens.",
    see: [["T4 · Margin", `${T4}#margin`]],
  },
  {
    term: "IOC", aka: ["Immediate or cancel"],
    def: "A [time in force](#time-in-force) for limit orders: it fills what it can at once and cancels the rest. A [market order](#market-order) is an IOC order priced through the book.",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`], ["API errors · IocCancel", "/errors/#ioc-cancel"]],
  },
  {
    term: "Isolated margin",
    def: "A margin mode that gives one position its own margin, which you can add to or remove after opening. The position is judged on that margin alone.",
    see: [["T4 · Margin", `${T4}#margin`]],
  },
  {
    term: "L1 action",
    def: "The signing scheme for trading and most other actions. The action is encoded with [msgpack](#msgpack), hashed with its nonce, and signed as a small EIP-712 message that carries the hash.",
    see: [["T3 · Two signing schemes", `${T3}#two-signing-schemes`], ["Lab · Sign without money", "/labs/sign-without-money/"]],
  },
  {
    term: "Liquidation",
    def: "When a cross account's value falls below the maintenance margin of its positions, they're sent to the book as market orders, those over 100k USDC a fifth at a time. Further down, the [backstop liquidator](#backstop-liquidator) takes over.",
    see: [["T4 · Liquidations", `${T4}#liquidations`]],
  },
  {
    term: "Maintenance margin",
    def: "The margin a position has to keep: half the initial margin at maximum leverage, which is 1.25% of notional for BTC at 40×. An account below it can be liquidated.",
    see: [["T4 · Margin", `${T4}#margin`]],
  },
  {
    term: "Margin tiers",
    def: "Bigger positions get less leverage: an asset's margin table lowers the maximum leverage, and so raises the margin needed, as a position grows.",
    see: [["Docs · Margin tiers", `${D}/trading/margin-tiers`], ["API errors · PerpMaxPosition", "/errors/#perp-max-position"]],
  },
  {
    term: "Mark price",
    def: "The price behind margin, liquidations, TP/SL triggers and unrealized pnl: the median of three estimates, drawn from the oracle, Hyperliquid's own book and other exchanges' perps.",
    see: [["T4 · Three prices, three jobs", `${T4}#three-prices-three-jobs`], ["Lab · Funding and mark price", "/labs/funding/"]],
  },
  {
    term: "Market order",
    def: "An [IOC](#ioc) order priced through the book, so it fills at once at the best prices available. The Python SDK prices it 5% past the mid by default.",
    see: [["T4 · Order types", `${T4}#order-types`]],
  },
  {
    term: "Mid price",
    def: "The middle of Hyperliquid's own book, between the best bid and the best ask.",
    see: [["T4 · Three prices, three jobs", `${T4}#three-prices-three-jobs`]],
  },
  {
    term: "msgpack",
    def: "The compact binary encoding an [L1 action](#l1-action) is hashed in. It keeps the order of fields, so the same fields in another order give another hash.",
    see: [["T3 · A wrong signature doesn't say what's wrong", `${T3}#a-wrong-signature-doesnt-say-whats-wrong`]],
  },
  {
    term: "Nonce",
    def: "A number every action carries so it can't be replayed. The exchange keeps each signer's 100 highest; a new one must be higher than the lowest of those, unused, and within 2 days before or 1 day after the block's time. Use the time in milliseconds.",
    see: [["T1 · Nonces work differently", `${T1}#nonces-work-differently`]],
  },
  {
    term: "oid", aka: ["Order ID"],
    def: "The ID the exchange gives an order when it's placed, returned in the order's status.",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`]],
  },
  {
    term: "Open interest cap",
    def: "A limit on an asset's open interest. At the cap, orders that would add to it are rejected. HIP-3 deployers set their own caps.",
    see: [["API errors · Open interest cap", "/errors/#position-increase-at-open-interest-cap"], ["T7 · The deployer's actions", `${T7}#the-deployers-actions`]],
  },
  {
    term: "Oracle price",
    def: "The price behind funding. Each validator takes a weighted median of spot prices on other exchanges, and the stake-weighted median across validators is published about every 3 seconds. HIP-3 deployers push their own.",
    see: [["T4 · Three prices, three jobs", `${T4}#three-prices-three-jobs`], ["T7 · The oracle duty", `${T7}#the-oracle-duty`]],
  },
  {
    term: "Outcome",
    def: "A HIP-4 contract with two sides, usually Yes and No, each a token. At settlement a Yes token pays [settleFraction](#settlefraction) of the quote token, and a No token the rest.",
    see: [["T8 · What an outcome is", `${T8}#what-an-outcome-is`]],
  },
  {
    term: "Perp DEX",
    def: "A perp exchange that a HIP-3 deployer runs on HyperCore, with its own assets, oracle and fees. Its coins carry its name, such as `xyz:XYZ100`.",
    see: [["T7 · Running a perp DEX", T7]],
  },
  {
    term: "Portfolio margin",
    def: "An account mode that pools all eligible assets, currently HYPE, BTC, USDC and USDT, into one portfolio for margin.",
    see: [["Docs · Account abstraction modes", `${D}/trading/account-abstraction-modes`]],
  },
  {
    term: "Precompile",
    def: "A built-in HyperEVM contract that returns HyperCore state, such as positions, spot balances and oracle prices, to a contract. Their addresses start at `0x…0800`.",
    see: [["Docs · Interacting with HyperCore", `${D}/for-developers/hyperevm/interacting-with-hypercore`]],
  },
  {
    term: "Premium",
    def: "How far Hyperliquid's book sits from the oracle, measured with [impact prices](#impact-price). It's sampled every 5 seconds and averaged into [funding](#funding).",
    see: [["T4 · Funding, worked through", `${T4}#funding-worked-through`]],
  },
  {
    term: "Question",
    def: "A HIP-4 group of outcomes of which exactly one settles Yes, such as \"who wins\". An \"other\" outcome is added automatically as the fallback.",
    see: [["T8 · What an outcome is", `${T8}#what-an-outcome-is`]],
  },
  {
    term: "Quote token",
    def: "The token a market is priced and settled in, such as USDC. A HIP-3 DEX can use any quote asset as its collateral.",
    see: [["T7 · What a deployer signs up for", `${T7}#what-a-deployer-signs-up-for`]],
  },
  {
    term: "Reduce-only",
    def: "A flag that lets an order shrink a position but never open or flip one.",
    see: [["T4 · Order types", `${T4}#order-types`], ["API errors · ReduceOnly", "/errors/#reduce-only"]],
  },
  {
    term: "Self-trade prevention",
    def: "When two of your orders would trade with each other, the resting one is cancelled instead, with no fee. Its status becomes `selfTradeCanceled`.",
    see: [["Docs · Self-trade prevention", `${D}/trading/self-trade-prevention`]],
  },
  {
    term: "settleFraction",
    def: "What one Yes token of an outcome pays at settlement, from 0 to 1 of the quote token; a No token pays the rest. A binary market settles to 0 or 1.",
    see: [["T8 · How a market settles", `${T8}#how-a-market-settles`], ["Lab · Settlement explorer", "/labs/settlement/"]],
  },
  {
    term: "Slashing",
    def: "Validators voting to take a deployer's stake for irregular behaviour: up to 100% for invalid state transitions or long outages, and up to 50% for brief downtime, whatever the cause.",
    see: [["T7 · What a deployer signs up for", `${T7}#what-a-deployer-signs-up-for`]],
  },
  {
    term: "Spot pair",
    def: "Two tokens traded against each other on HyperCore, such as PURR/USDC. Orders name it by `10000 +` its index in `spotMeta`, and its coin name is either the pair or `@` and that index.",
    see: [["T2 · Every market type names its assets differently", `${T2}#every-market-type-names-its-assets-differently`]],
  },
  {
    term: "Sub-account",
    def: "An extra account under a master account, with no key of its own: the master, or its API wallet, signs with [vaultAddress](#vaultaddress) set to it.",
    see: [["T3 · Two signing schemes", `${T3}#two-signing-schemes`], ["Docs · Sub-accounts", `${D}/trading/sub-accounts`]],
  },
  {
    term: "Sub-deployer",
    def: "A key that a deployer allows to send one deploy action, such as `setOracle`, so the deployer's own key can stay offline.",
    see: [["T7 · Keep the deployer key cold", `${T7}#keep-the-deployer-key-cold`]],
  },
  {
    term: "szDecimals",
    def: "How many decimals an asset's order sizes may have. It also limits prices, to `6 − szDecimals` decimals for perps and `8 − szDecimals` for spot.",
    see: [["T2 · Prices and sizes have strict precision", `${T2}#prices-and-sizes-have-strict-precision`]],
  },
  {
    term: "Testnet",
    def: "Hyperliquid's test network, at `api.hyperliquid-testnet.xyz`. Its faucet gives 1,000 mock USDC, but only to addresses that have deposited on mainnet.",
    see: [["T1 · Getting testnet funds", `${T1}#getting-testnet-funds`]],
  },
  {
    term: "Tick size",
    def: "The precision a price may have: at most 5 significant figures and a set number of decimals, though whole-number prices are always allowed.",
    see: [["T2 · Prices and sizes have strict precision", `${T2}#prices-and-sizes-have-strict-precision`], ["API errors · Tick", "/errors/#tick"]],
  },
  {
    term: "Time in force", aka: ["TIF"],
    def: "What a limit order does when it can't fill at once: rest on the book ([GTC](#gtc)), cancel the rest ([IOC](#ioc)), or be cancelled rather than match ([ALO](#alo)).",
    see: [["T3 · Order types, briefly", `${T3}#order-types-briefly`]],
  },
  {
    term: "TP/SL", aka: ["Take profit", "Stop loss"],
    def: "Take-profit and stop-loss orders, which close a position when the mark price reaches their trigger. They're market orders unless you set a limit price.",
    see: [["T4 · Order types", `${T4}#order-types`], ["API errors · BadTriggerPx", "/errors/#bad-trigger-px"]],
  },
  {
    term: "Trigger order", aka: ["Stop order"],
    def: "An order that waits for a trigger price before it goes to the book, such as a stop or a take-profit.",
    see: [["T4 · Order types", `${T4}#order-types`]],
  },
  {
    term: "TWAP",
    def: "An order type that splits a large order into suborders at least 30 seconds apart, each with at most 3% slippage. In HIP-4 market templates it means a time-weighted average price, and venues work it out differently.",
    see: [["T4 · Order types", `${T4}#order-types`], ["T8 · What TWAP means depends on the venue", `${T8}#what-twap-means-depends-on-the-venue`]],
  },
  {
    term: "Unified account",
    def: "The account mode the docs recommend for most users: one balance per asset serves spot and every perp DEX.",
    see: [["Docs · Account abstraction modes", `${D}/trading/account-abstraction-modes`]],
  },
  {
    term: "User-signed action",
    def: "The signing scheme for actions that move funds or grant permissions, such as withdrawals, transfers and approvals: EIP-712 typed data a wallet can show, signed by the account's own key.",
    see: [["T3 · Two signing schemes", `${T3}#two-signing-schemes`]],
  },
  {
    term: "Validator",
    def: "A node that takes part in consensus, publishes oracle prices and votes on matters such as slashing. The active set is the 27 with the most stake.",
    see: [["Docs · Running a validator", `${D}/validators/running-a-validator`]],
  },
  {
    term: "Vault",
    def: "A pool that others deposit into and someone else trades. New vaults are HyperEVM contracts that trade through [CoreWriter](#corewriter); the older HyperCore vaults, from 2023, can't trade spot or HIP-3.",
    see: [["Docs · Vaults", `${D}/hypercore/vaults`]],
  },
  {
    term: "vaultAddress",
    def: "The request field that makes an action act for a sub-account or vault. The master account, or its API wallet, signs it.",
    see: [["T3 · Two signing schemes", `${T3}#two-signing-schemes`]],
  },
  {
    term: "WHYPE", aka: ["Wrapped HYPE"],
    def: "Wrapped HYPE, the canonical ERC-20 HYPE on the HyperEVM, at `0x555…5`. It's immutable, with the same code as WETH.",
    see: [["Docs · Wrapped HYPE", `${D}/for-developers/hyperevm/wrapped-hype`]],
  },
];

/** A term's anchor on /glossary/: "Time in force" becomes "time-in-force", "TP/SL" becomes "tp-sl". */
export const termId = (term: string) => term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
