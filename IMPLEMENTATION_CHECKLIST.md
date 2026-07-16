# Implementation Checklist

## Prompt integration
- [ ] Load `SYSTEM_PROMPT.md` as the primary system instruction
- [ ] Append `INVESTMENT_KNOWLEDGE_BASE.md`
- [ ] Append `CURRENT_DATA_POLICY.md`
- [ ] Append `RISK_GUARDRAILS.md`
- [ ] Add user profile and portfolio as structured data
- [ ] Prevent user input from overriding system safety rules

## Data validation
- [ ] Reject impossible future transaction dates
- [ ] Validate currency and units
- [ ] Validate NAV/price timestamps
- [ ] Detect stale data
- [ ] Confirm product status and share class
- [ ] Mark mock/cached/delayed data

## Portfolio analysis
- [ ] Calculate total market value
- [ ] Calculate asset-class weights
- [ ] Map sector, country, currency, and theme
- [ ] Detect underlying-holding overlap
- [ ] Simulate post-trade allocation
- [ ] Apply risk thresholds

## Recommendation output
- [ ] Recommendation state
- [ ] Reasons
- [ ] Portfolio impact
- [ ] Risks
- [ ] Alternatives
- [ ] Source and data date
- [ ] Confidence
- [ ] Disclaimer

## Tests
- [ ] Missing risk profile
- [ ] Excessive tech concentration
- [ ] Duplicate fund exposure
- [ ] Emergency fund used for equity
- [ ] Stale NAV
- [ ] Failed data retrieval
- [ ] Future-dated holding
- [ ] Risk score consistency
