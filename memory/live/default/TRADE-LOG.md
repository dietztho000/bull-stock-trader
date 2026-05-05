# Trade Log

## Day 0 — EOD Snapshot (pre-launch baseline)
**Portfolio:** $10,000.00 | **Cash:** $10,000.00 (100%) | **Day P&L:** $0 | **Phase P&L:** $0

No positions yet. Bot launches tomorrow.

---

### Apr 30 — EOD Snapshot (Day 1, Thursday)
**Portfolio:** $99,651.33 | **Cash:** $46,829.98 (47.0%) | **Day P&L:** -$348.67 (-0.35%) | **Phase P&L:** -$348.67 (-0.35%)
**vs SPY:** day N/A (baseline set today $693.23) | phase -0.35% alpha

| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
|--------|--------|-------|-------|---------|----------------|------|
| AMKR | 220 | $68.14 | $69.78 | -1.17% | +$360.80 (+2.41%) | $63.03 |
| NVDA | 95 | $209.24 | $199.53 | -4.65% | -$922.74 (-4.64%) | $181.80 |
| XOM | 120 | $152.51 | $154.29 | -0.25% | +$213.25 (+1.17%) | $140.12 |

**Notes:** Day 1 of live trading. Three positions entered at market-open: AMKR (semiconductor packaging, +2.41% unrealized), NVDA (AI chips, -4.64% unrealized), XOM (energy, +1.17% unrealized). Broad market weakness hit all three today; NVDA dragged hardest at -4.65% intraday. Portfolio is 53% deployed — below the 75-85% target — with $46,830 cash available for 1-2 more positions pending research. All three have 10% trailing GTC stops in place. RUN-LOG shows only seed entry; routines appear to have run outside log scope on Day 1 bootstrap.

---

### May 01 — EOD Snapshot (Day 2, Friday)
**Portfolio:** $99,644.13 | **Cash:** $46,829.98 (47.0%) | **Day P&L:** -$9.60 (-0.01%) | **Phase P&L:** -$355.87 (-0.36%)
**vs SPY:** day -3.95% alpha (SPY +3.94%) | phase -4.30% alpha

| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
|--------|--------|-------|-------|---------|----------------|------|
| AMKR | 220 | $68.14 | $71.00 | +1.79% | +$629.20 (+4.20%) | $64.50 |
| NVDA | 95 | $209.24 | $198.57 | -0.50% | -$1,013.87 (-5.10%) | $182.70 |
| XOM | 120 | $152.51 | $152.75 | -1.02% | +$28.80 (+0.16%) | $140.12 |

**Notes:** Market surged +3.94% today (SPY $693.23 → $720.56). Portfolio essentially flat (-0.01%) due to 53% deployment — cash drag cost ~2% alpha alone. AMKR led +1.79% intraday; NVDA -0.50% and XOM -1.02%. NVDA now -5.10% unrealized, approaching -7% cut threshold — watch closely Monday. Trailing stops updated: AMKR HWM $71.67/stop $64.50, NVDA HWM $203.00/stop $182.70, XOM HWM $155.69/stop $140.12. No trades today; week closes at 3/3 trade cap. Priority Monday: deploy remaining $46.8k into 1-2 positions to reach 75-85% target.

---

### May 05 11:10 CT — Stop Promotion

- GOOGL: promoted fixed stop_limit ($355.99/$352.17) → trailing_stop 10% GTC
  - Order ID: efb5844c-4419-4e64-bdf3-e3140ffb2155 (client: bsl-1777997403-9cf699e5)
  - HWM: $387.68 | Stop: $348.91 | unrealized_plpc at promotion: +1.19%
  - (Alpaca API does not support type-change via PATCH; cancel+reissue with minimal gap)

---

### May 05 — EOD Snapshot (Day 4, Tuesday)
**Portfolio:** $101,128.09 | **Cash:** $34,963.49 (34.6%) | **Day P&L:** +$1,475.56 (+1.48%) | **Phase P&L:** +$1,128.09 (+1.13%)
**vs SPY:** day +0.63% alpha (SPY +0.85%) | phase -3.28% alpha

| Ticker | Shares | Entry | Close | Day Chg | Unrealized P&L | Stop |
|--------|--------|-------|-------|---------|----------------|------|
| AMKR | 220 | $68.14 | $76.82 | +8.26% | +$1,909.60 (+12.74%) | $69.80 |
| GOOGL | 31 | $382.79 | $388.38 | +1.34% | +$173.29 (+1.46%) | $349.70 |
| NVDA | 95 | $209.24 | $196.25 | -1.12% | -$1,234.28 (-6.21%) | $182.70 |
| XOM | 120 | $152.51 | $154.88 | +0.77% | +$284.40 (+1.55%) | $139.76 |

**Notes:** Strong day: portfolio +1.48% vs SPY +0.85%, generating +0.63% daily alpha. AMKR was the standout (+8.26% intraday) on semiconductor packaging momentum, now +12.74% unrealized — approaching the +15% tighten-stop threshold. GOOGL promoted to trailing 10% stop mid-morning after crossing +1%; holding well. NVDA lagged again (-1.12%, -6.21% unrealized) — watch closely tomorrow, stop at $182.70. XOM quiet +0.77%. No new trades; week at 1/3 cap. Auth-canary, mid-morning, late-morning, stops, and afternoon routines did not log completion — watchdog alert fired.
