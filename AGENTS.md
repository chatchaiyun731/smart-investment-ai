# AGENTS.md — Smart Investment AI

## Purpose
This repository contains a personal investment analysis system. All agents and developers must prioritize correctness, traceability, user suitability, and risk control.

## Mandatory files
Do not remove or bypass:
- SYSTEM_PROMPT.md
- INVESTMENT_KNOWLEDGE_BASE.md
- CURRENT_DATA_POLICY.md
- RISK_GUARDRAILS.md
- PROJECT_CONTEXT.md

## Development rules

1. Never hard-code API keys, tokens, passwords, or personal financial data.
2. Use environment variables and provide `.env.example`.
3. Preserve auditability:
   - source,
   - timestamp,
   - calculation inputs,
   - model version,
   - and recommendation output.
4. Never silently fall back to mock data in production.
5. Clearly label mock, delayed, cached, or incomplete data.
6. Validate:
   - dates,
   - currencies,
   - units,
   - percentages,
   - NAV,
   - and portfolio weights.
7. Portfolio weights must reconcile within an acceptable rounding tolerance.
8. Risk score direction must be consistent:
   - higher score = higher risk.
9. Write tests for:
   - future-date rejection,
   - stale-data detection,
   - duplicate-exposure detection,
   - risk-limit enforcement,
   - and missing-profile handling.
10. No recommendation engine may bypass the risk guardrails.

## Required recommendation pipeline

1. Load user profile.
2. Load portfolio.
3. Validate data.
4. Fetch current market/product data.
5. Check freshness.
6. Calculate exposure and overlap.
7. Apply suitability rules.
8. Apply risk limits.
9. Generate recommendation.
10. Attach sources, dates, confidence, and warnings.
11. Log the decision inputs and outputs.

## Pull request checklist

- [ ] No secrets committed
- [ ] Current-data check implemented
- [ ] Risk guardrails enforced
- [ ] Duplicate exposure tested
- [ ] Missing user profile handled safely
- [ ] Sources and timestamps included
- [ ] Mock data cannot appear as real data
- [ ] Risk score interpretation tested
- [ ] Documentation updated
