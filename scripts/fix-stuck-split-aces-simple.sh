#!/bin/bash
#
# Fix Stuck Split Aces Games - Simple SQL Approach
#
# Usage:
#   ./scripts/fix-stuck-split-aces-simple.sh              # Fix all stuck games
#   ./scripts/fix-stuck-split-aces-simple.sh [gameId]    # Fix specific game
#
# This script marks stuck split aces games as completed.
# Note: This does NOT calculate proper payouts - it just unsticks the UI.
#

GAME_ID="${1}"

if [ -z "$GAME_ID" ]; then
  echo "Finding all stuck split aces games..."
  echo ""

  # Find and fix all stuck games
  docker exec -i zetik_postgres psql -U postgres -d postgres << 'EOF'
BEGIN;

-- Show all stuck games
SELECT
    id,
    status,
    "isSplit",
    "isSplitAces",
    "betAmount",
    "totalBetAmount",
    "createdAt"
FROM games.blackjack_games
WHERE status = 'active' AND "isSplit" = true AND "isSplitAces" = true
ORDER BY "createdAt" DESC;

-- Count how many we'll fix
SELECT COUNT(*) as stuck_games_count
FROM games.blackjack_games
WHERE status = 'active' AND "isSplit" = true AND "isSplitAces" = true;

-- Update all stuck split aces games to completed
UPDATE games.blackjack_games
SET
    status = 'completed',
    "updatedAt" = NOW()
WHERE
    status = 'active'
    AND "isSplit" = true
    AND "isSplitAces" = true;

-- Show updated count
SELECT COUNT(*) as fixed_games_count
FROM games.blackjack_games
WHERE status = 'completed' AND "isSplit" = true AND "isSplitAces" = true
AND "updatedAt" > NOW() - INTERVAL '1 minute';

COMMIT;
EOF

  echo ""
  echo "✅ All stuck split aces games have been fixed"
else
  echo "Fixing specific stuck split aces game: $GAME_ID"
  echo ""

  # Fix specific game
  docker exec -i zetik_postgres psql -U postgres -d postgres << EOF
BEGIN;

-- Show current state
SELECT
    id,
    status,
    "isSplit",
    "isSplitAces",
    "betAmount",
    "totalBetAmount",
    "winAmount",
    "payoutMultiplier"
FROM games.blackjack_games
WHERE id = '$GAME_ID';

-- Update to completed (note: enum values are lowercase)
UPDATE games.blackjack_games
SET
    status = 'completed',
    "updatedAt" = NOW()
WHERE
    id = '$GAME_ID'
    AND status = 'active';

-- Show updated state
SELECT
    id,
    status,
    "isSplit",
    "isSplitAces",
    "betAmount",
    "totalBetAmount",
    "winAmount",
    "payoutMultiplier"
FROM games.blackjack_games
WHERE id = '$GAME_ID';

COMMIT;
EOF

  echo ""
  echo "✅ Game $GAME_ID has been marked as completed"
fi

echo ""
echo "⚠️  Note: This does NOT calculate payouts or credit winnings."
echo "   Games will show as completed but winAmount may be empty/incorrect."
echo "   The fix only unsticks the UI - proper payout calculation was not run."
