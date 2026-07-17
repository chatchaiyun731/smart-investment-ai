# Smart Investment AI — Knowledge Base and Analysis Rules

## 1. Investor profile inputs

The system should store or request:
- investment objective,
- time horizon,
- risk tolerance,
- acceptable drawdown,
- monthly income,
- fixed expenses,
- emergency reserve,
- outstanding high-interest debt,
- expected major cash needs,
- tax considerations,
- existing portfolio,
- investment experience,
- and currency exposure.

## 2. Portfolio classification

Each holding should be tagged by:

### Asset class
- Cash
- Money market
- Government bonds
- Investment-grade bonds
- High-yield bonds
- Thai equities
- Developed-market equities
- Emerging-market equities
- REITs/property funds
- Infrastructure
- Gold/precious metals
- Commodities
- Alternatives
- Crypto
- Other

### Risk dimensions
- Market risk
- Credit risk
- Interest-rate risk
- Duration risk
- Currency risk
- Liquidity risk
- Concentration risk
- Political/regulatory risk
- Leverage risk
- Derivative risk

### Exposure dimensions
- Region
- Country
- Sector
- Theme
- Currency
- Issuer
- Top underlying holdings
- Market-cap style
- Growth/value style
- Duration
- Credit quality

## 3. Concentration and overlap rules

The system must calculate, where data is available:
- asset-class weights,
- equity/bond/cash split,
- country weights,
- sector weights,
- currency weights,
- theme weights,
- issuer weights,
- top underlying company weights,
- and combined exposure across funds.

A fund name alone is not enough to determine diversification.

Examples:
- A global equity fund and a Nasdaq fund may both have large US mega-cap technology exposure.
- An infrastructure fund and a REIT fund may both be sensitive to interest rates.
- A gold fund and a gold ETF may duplicate the same underlying exposure.

## 4. Risk scoring

Risk score must be transparent and interpretable.

Suggested 0–100 scale:
- 0–20: very low
- 21–40: low
- 41–60: moderate
- 61–80: high
- 81–100: very high

The system must never label a nearly all-equity, thematic, leveraged, or crypto-heavy portfolio as low risk.

Risk scoring should consider:
- equity allocation,
- thematic concentration,
- geographic concentration,
- currency mismatch,
- portfolio volatility,
- maximum drawdown,
- bond duration,
- bond credit quality,
- leverage,
- liquidity,
- and emergency-reserve adequacy.

## 5. Return assumptions

- Use verified historical data when available.
- Clearly separate:
  - historical return,
  - expected return,
  - scenario estimate,
  - and guaranteed return.
- Never convert a short-term return into an annual return without explanation.
- Never present expected returns as facts.

## 6. Scenario analysis

At minimum, consider:
- base case,
- downside case,
- severe downside case,
- and liquidity-need case.

Examples:
- equity market falls 20–30%,
- interest rates rise,
- currency moves against the user,
- fund redemption is delayed,
- or emergency cash is needed earlier than expected.

## 7. DCA rules

DCA may reduce timing risk but does not remove market risk.

Before recommending DCA:
- verify the asset is suitable for the time horizon,
- check whether the user already has excessive exposure,
- set a maximum portfolio weight,
- define review points,
- and define stop/reassessment conditions.

## 8. Rebalancing rules

Rebalancing should be triggered by:
- deviation from target allocation,
- material change in risk profile,
- major change in product policy,
- excessive concentration,
- or change in user goals.

Avoid excessive trading. Consider fees, taxes, spreads, and settlement time.

## 9. Fund analysis checklist

For mutual funds and ETFs verify:
- current fund name and share class,
- management company,
- investment policy,
- benchmark,
- currency hedging policy,
- current fees,
- redemption terms,
- current sales status,
- latest factsheet date,
- latest NAV date,
- asset allocation,
- top holdings,
- historical volatility,
- drawdown,
- and risk level.

## 10. Stock analysis checklist

Verify:
- latest price and timestamp,
- exchange and currency,
- business model,
- revenue and earnings trend,
- debt and cash,
- valuation,
- dilution risk,
- sector and country risk,
- and major upcoming events.

## 11. Data hierarchy

Prefer sources in this order:
1. Regulator
2. Fund manager / issuer official documents
3. Exchange
4. Company filings
5. Audited financial statements
6. Reputable market-data provider
7. Reputable news source
8. Secondary commentary

Do not rely on social media posts as the sole source for an investment recommendation.

## 12. Output discipline

Every analysis should distinguish:
- verified fact,
- calculation,
- assumption,
- opinion,
- and uncertainty.
