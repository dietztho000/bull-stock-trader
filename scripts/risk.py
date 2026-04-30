#!/usr/bin/env python3
"""Portfolio risk metrics — beta vs SPY, pairwise correlation, simple Sharpe.

Reads JSON from stdin in the form:
{
  "spy_closes":      [{"t": "...", "c": 412.31}, ...],   # >= 60 daily bars
  "positions": [
    {"symbol": "AAPL", "qty": 10, "market_value": 1850.0,
     "closes": [{"t": "...", "c": 184.5}, ...]},
    ...
  ],
  "equity": 10000.0
}

Writes a JSON summary to stdout with beta, correlation matrix, and a single
text "deployment recommendation" line. No external deps — pure stdlib.
"""
from __future__ import annotations

import json
import math
import sys
from typing import Dict, List, Sequence, Tuple


def daily_returns(closes: Sequence[float]) -> List[float]:
    return [(b - a) / a for a, b in zip(closes[:-1], closes[1:]) if a > 0]


def mean(xs: Sequence[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def variance(xs: Sequence[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)


def covariance(xs: Sequence[float], ys: Sequence[float]) -> float:
    n = min(len(xs), len(ys))
    if n < 2:
        return 0.0
    xs, ys = xs[-n:], ys[-n:]
    mx, my = mean(xs), mean(ys)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (n - 1)


def correlation(xs: Sequence[float], ys: Sequence[float]) -> float:
    sx, sy = math.sqrt(variance(xs)), math.sqrt(variance(ys))
    if sx == 0 or sy == 0:
        return 0.0
    return covariance(xs, ys) / (sx * sy)


def beta(asset_rets: Sequence[float], mkt_rets: Sequence[float]) -> float:
    mv = variance(mkt_rets)
    return covariance(asset_rets, mkt_rets) / mv if mv > 0 else 0.0


def deployment_advice(portfolio_beta: float, vix_level: float | None,
                      deployed_pct: float) -> str:
    # Simple guidance: bias toward the upper band when beta is low or VIX
    # is calm; bias toward the lower band when beta is high or VIX is hot.
    band_low, band_high = 75.0, 85.0
    target = (band_low + band_high) / 2
    if portfolio_beta > 1.4:
        target -= 5
    if portfolio_beta < 0.8:
        target += 3
    if vix_level is not None:
        if vix_level >= 25:
            target -= 8
        elif vix_level >= 20:
            target -= 4
        elif vix_level <= 13:
            target += 3
    target = max(60.0, min(90.0, target))
    delta = target - deployed_pct
    direction = "trim" if delta < -2 else "add" if delta > 2 else "hold"
    return (f"Beta {portfolio_beta:.2f}, VIX "
            f"{f'{vix_level:.1f}' if vix_level is not None else 'unknown'}, "
            f"deployed {deployed_pct:.1f}% — recommendation: {direction} "
            f"toward {target:.0f}% (delta {delta:+.1f}pp).")


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("usage: pipe JSON to risk.py (see header docstring)",
              file=sys.stderr)
        return 1
    data = json.loads(raw)

    spy_closes = [float(b["c"]) for b in data["spy_closes"]]
    spy_rets = daily_returns(spy_closes)
    if len(spy_rets) < 30:
        print(f"WARNING: only {len(spy_rets)} SPY daily returns "
              "(need >=30 for stable beta)", file=sys.stderr)

    equity = float(data.get("equity", 0.0))
    positions = data.get("positions", [])
    weights: Dict[str, float] = {}
    asset_rets: Dict[str, List[float]] = {}
    for p in positions:
        sym = p["symbol"]
        mv = float(p.get("market_value", 0.0))
        weights[sym] = mv / equity if equity > 0 else 0.0
        closes = [float(b["c"]) for b in p["closes"]]
        asset_rets[sym] = daily_returns(closes)

    betas = {sym: beta(rets, spy_rets) for sym, rets in asset_rets.items()}
    portfolio_beta = sum(weights[sym] * betas[sym] for sym in weights)

    syms = list(weights.keys())
    correlation_matrix: Dict[str, Dict[str, float]] = {}
    for a in syms:
        correlation_matrix[a] = {}
        for b_ in syms:
            correlation_matrix[a][b_] = round(correlation(asset_rets[a], asset_rets[b_]), 3)

    deployed_pct = sum(weights.values()) * 100
    vix = data.get("vix")
    advice = deployment_advice(portfolio_beta, vix, deployed_pct)

    out = {
        "portfolio_beta": round(portfolio_beta, 3),
        "per_position_beta": {s: round(b_, 3) for s, b_ in betas.items()},
        "weights_pct": {s: round(w * 100, 2) for s, w in weights.items()},
        "deployed_pct": round(deployed_pct, 2),
        "correlation_matrix": correlation_matrix,
        "vix": vix,
        "advice": advice,
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
