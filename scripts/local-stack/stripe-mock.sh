#!/usr/bin/env bash
# Local Stripe API stand-in for tests (no network, no real Stripe account): stripe-mock
# (https://github.com/stripe/stripe-mock). Install: brew install stripe/stripe-mock/stripe-mock
# (or set STRIPE_MOCK_BIN to the binary). Then run the payment tests with
#   STRIPE_MOCK_URL=http://127.0.0.1:12111 node --import ./tests/register.mjs --test tests/e2e/payments.test.mjs
# For a local build of the site, STRIPE_API_BASE=http://127.0.0.1:12111 (ignored in production)
# with STRIPE_SECRET_KEY=sk_test_123 sends the server's Stripe calls there too.
set -euo pipefail
WORK="${LOCAL_STACK_DIR:-/tmp/tlc-local-stack}"
PORT="${STRIPE_MOCK_PORT:-12111}"
BIN="${STRIPE_MOCK_BIN:-$(command -v stripe-mock || true)}"
case "${1:-start}" in
  stop) [ -f "$WORK/stripe-mock.pid" ] && kill "$(cat "$WORK/stripe-mock.pid")" 2>/dev/null || true; rm -f "$WORK/stripe-mock.pid"; echo "stopped" ;;
  start)
    [ -n "$BIN" ] || { echo "stripe-mock not found: brew install stripe/stripe-mock/stripe-mock, or set STRIPE_MOCK_BIN"; exit 1; }
    mkdir -p "$WORK"
    nohup "$BIN" -http-port "$PORT" -https-port $((PORT + 1)) > "$WORK/stripe-mock.log" 2>&1 & echo $! > "$WORK/stripe-mock.pid"
    sleep 1
    curl -fsS "http://127.0.0.1:$PORT/v1/customers" -u sk_test_123: >/dev/null && echo "stripe-mock ready: STRIPE_MOCK_URL=http://127.0.0.1:$PORT" || { echo "stripe-mock failed; see $WORK/stripe-mock.log"; exit 1; } ;;
esac
