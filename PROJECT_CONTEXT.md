# PROJECT_CONTEXT.md — Smart Investment AI

## Project objective
Build a reliable personal investment analysis assistant that evaluates decisions at the whole-portfolio level rather than recommending isolated products.

## Primary user outcomes
- Understand current portfolio risk
- Identify concentration and duplication
- Allocate new money
- Plan DCA
- Rebalance
- Compare funds, ETFs, stocks, bonds, gold, infrastructure, and cash
- Prepare for adverse market scenarios

## System principles
- Current data before advice
- Portfolio-first analysis
- No fabricated information
- Transparent assumptions
- Risk suitability
- Concentration control
- Clear uncertainty and confidence
- User retains final decision authority

## Current expert-rule package
The following files define the operating standard:
- `SYSTEM_PROMPT.md`
- `INVESTMENT_KNOWLEDGE_BASE.md`
- `CURRENT_DATA_POLICY.md`
- `RISK_GUARDRAILS.md`
- `AGENTS.md`

## Recommended architecture

### Data layer
- User profile
- Portfolio holdings
- Transactions
- Product metadata
- Market prices / NAV
- Fund factsheets
- Recommendation audit log

### Analysis layer
- Portfolio allocation
- Exposure mapping
- Overlap detection
- Risk scoring
- Scenario testing
- Suitability engine
- Rebalancing engine

### AI layer
- Prompt assembly
- Tool/data retrieval
- Source citation
- Recommendation explanation
- Confidence scoring

### Safety layer
- Data freshness validation
- Risk guardrails
- Missing-data gate
- Duplicate-exposure gate
- Mock-data protection
- Audit logging

## Known issues to prevent
- Future-dated transactions accepted without validation
- Risk score displayed in the wrong direction
- Stale data described as current
- Advice produced without portfolio review
- Fund overlap missed because only fund names were compared
- Mock or cached data presented as live data

## Integration requirement
At runtime, the application should load and combine:
1. System Prompt
2. Knowledge Base
3. Current Data Policy
4. Risk Guardrails
5. User profile
6. Current portfolio
7. Verified current market/product data

The recommendation should not be generated if required safety checks fail.
