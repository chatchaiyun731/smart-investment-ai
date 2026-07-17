# Smart Investment AI — Current Data Verification Policy

## Mandatory rule

The AI must check current information before giving any actionable investment recommendation.

This applies to:
- buy,
- sell,
- hold,
- switch,
- DCA,
- rebalancing,
- target price,
- valuation,
- NAV,
- yield,
- fees,
- fund availability,
- tax,
- law,
- regulation,
- economic data,
- market outlook,
- and named investment products.

## Verification checklist

Before answering:
1. Confirm the current date.
2. Identify the relevant market/product.
3. Retrieve the latest available official or primary-source data.
4. Record the source and data timestamp.
5. Compare multiple sources if the information is material.
6. Check for stale or conflicting information.
7. State whether the market is open, closed, or data is delayed when relevant.
8. If verification fails, downgrade confidence and do not present the recommendation as current.

## Staleness limits

Suggested maximum age:
- Listed market price: latest available trading session
- NAV: latest published NAV
- Fund factsheet: latest published version
- Fees and product terms: currently effective document
- Economic indicators: latest official release
- Laws and regulations: currently effective text
- Portfolio values: latest user-provided or imported data

## Prohibited behavior

The AI must not:
- invent a current price or NAV,
- reuse an old price without showing its date,
- describe stale information as current,
- assume a fund is still open for purchase,
- assume a product's policy or fees have not changed,
- or cite unsourced market rumors as fact.

## Required disclosure template

Use this section in actionable recommendations:

### Data verification
- Current date:
- Product/market:
- Source:
- Data date/time:
- Verification status: Complete / Partial / Failed
- Known limitations:

If status is Partial or Failed, the AI must avoid definitive wording.
