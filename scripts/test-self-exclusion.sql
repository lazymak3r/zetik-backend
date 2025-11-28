-- Self-Exclusion Testing SQL Scripts
-- Use these to manually manipulate dates for testing without waiting 24 hours
-- WARNING: For development/staging only - DO NOT use in production

-- ==============================================================================
-- USAGE INSTRUCTIONS
-- ==============================================================================
-- 1. Connect to database:
--    docker exec -it zetik_postgres psql -U postgres -d postgres
--
-- 2. Get your exclusion IDs first (see query #4 below)
--
-- 3. Run desired test scenario by copying the SQL query
--
-- 4. Refresh your application or API to see changes
-- ==============================================================================

-- ==============================================================================
-- SCENARIO 1: EXPIRE A COOLDOWN (start post-cooldown window)
-- ==============================================================================
-- This simulates a cooldown that has completed its 24-hour period
-- and is now in the post-cooldown window where the user can extend it
--
-- Replace YOUR_COOLDOWN_ID with actual ID from database
-- ==============================================================================
UPDATE users.self_exclusion
SET
  "endDate" = NOW() - INTERVAL '1 hour',
  "postCooldownWindowEnd" = NOW() + INTERVAL '24 hours'
WHERE id = 'YOUR_COOLDOWN_ID'
  AND type = 'COOLDOWN';

-- Verify the change:
SELECT id, type, "endDate", "postCooldownWindowEnd", "isActive"
FROM users.self_exclusion
WHERE id = 'YOUR_COOLDOWN_ID';

-- ==============================================================================
-- SCENARIO 2: EXPIRE POST-COOLDOWN WINDOW (trigger silent revert)
-- ==============================================================================
-- This simulates the 24-hour post-cooldown window expiring
-- The cron job will delete this record, silently reverting the account to normal
--
-- Replace YOUR_COOLDOWN_ID with actual ID
-- ==============================================================================
UPDATE users.self_exclusion
SET "postCooldownWindowEnd" = NOW() - INTERVAL '1 hour'
WHERE id = 'YOUR_COOLDOWN_ID';

-- Then manually run cron to see deletion:
-- Use the admin API endpoint: POST /v1/users/self-exclusion/test/run-cron

-- Verify the change:
SELECT id, type, "postCooldownWindowEnd", "isActive"
FROM users.self_exclusion
WHERE id = 'YOUR_COOLDOWN_ID';

-- ==============================================================================
-- SCENARIO 3: EXPIRE REMOVAL COUNTDOWN (trigger limit deletion)
-- ==============================================================================
-- This simulates the 24-hour removal countdown for a limit expiring
-- The cron job will delete this limit
--
-- Replace YOUR_LIMIT_ID with actual ID of a deposit/loss/wager limit
-- ==============================================================================
UPDATE users.self_exclusion
SET "removalRequestedAt" = NOW() - INTERVAL '25 hours'
WHERE id = 'YOUR_LIMIT_ID'
  AND type IN ('LOSS_LIMIT', 'WAGER_LIMIT', 'DEPOSIT_LIMIT');

-- Verify the change:
SELECT id, type, "removalRequestedAt", "isActive"
FROM users.self_exclusion
WHERE id = 'YOUR_LIMIT_ID';

-- ==============================================================================
-- SCENARIO 4: VIEW ALL SELF-EXCLUSIONS FOR A USER
-- ==============================================================================
-- Replace YOUR_USER_ID with actual user ID
-- ==============================================================================
SELECT
  id,
  type,
  "platformType",
  "isActive",
  "startDate",
  "endDate",
  "postCooldownWindowEnd",
  "removalRequestedAt",
  "limitAmount",
  period,
  CASE
    WHEN "postCooldownWindowEnd" IS NOT NULL
      AND "postCooldownWindowEnd" > NOW()
      AND type = 'COOLDOWN'
    THEN true
    ELSE false
  END as "isInPostCooldownWindow",
  CASE
    WHEN "removalRequestedAt" IS NOT NULL
    THEN true
    ELSE false
  END as "isRemovalPending",
  CASE
    WHEN "removalRequestedAt" IS NOT NULL
    THEN "removalRequestedAt" + INTERVAL '24 hours'
    ELSE NULL
  END as "removalExpiresAt",
  "createdAt",
  "updatedAt"
FROM users.self_exclusion
WHERE "userId" = 'YOUR_USER_ID'
ORDER BY "createdAt" DESC;

-- ==============================================================================
-- SCENARIO 5: PREVIEW CRON JOB ACTIONS
-- ==============================================================================
-- This shows what would be expired/deleted on next cron run
-- without actually making changes
-- ==============================================================================

-- Cooldowns that will enter post-cooldown window:
SELECT
  id,
  "userId",
  type,
  "endDate",
  "postCooldownWindowEnd",
  'WILL ENTER POST-COOLDOWN WINDOW' as action
FROM users.self_exclusion
WHERE type = 'COOLDOWN'
  AND "endDate" < NOW()
  AND "postCooldownWindowEnd" IS NULL
  AND "isActive" = true;

-- Cooldowns that will be deleted (silent revert):
SELECT
  id,
  "userId",
  type,
  "postCooldownWindowEnd",
  'WILL BE DELETED (SILENT REVERT)' as action
FROM users.self_exclusion
WHERE type = 'COOLDOWN'
  AND "postCooldownWindowEnd" < NOW();

-- Limits that will be deleted (removal countdown expired):
SELECT
  id,
  "userId",
  type,
  "removalRequestedAt",
  "removalRequestedAt" + INTERVAL '24 hours' as "removalDeadline",
  'WILL BE DELETED (COUNTDOWN EXPIRED)' as action
FROM users.self_exclusion
WHERE type IN ('LOSS_LIMIT', 'WAGER_LIMIT', 'DEPOSIT_LIMIT')
  AND "removalRequestedAt" IS NOT NULL
  AND "removalRequestedAt" < NOW() - INTERVAL '24 hours';

-- Temporary exclusions that will be deactivated:
SELECT
  id,
  "userId",
  type,
  "endDate",
  'WILL BE DEACTIVATED' as action
FROM users.self_exclusion
WHERE type = 'TEMPORARY'
  AND "endDate" < NOW()
  AND "isActive" = true;

-- ==============================================================================
-- SCENARIO 6: RESET ALL SELF-EXCLUSIONS FOR A USER (testing only)
-- ==============================================================================
-- WARNING: This deletes all self-exclusions for a user
-- Only use for testing/development
--
-- Replace YOUR_USER_ID with actual user ID
-- ==============================================================================
DELETE FROM users.self_exclusion
WHERE "userId" = 'YOUR_USER_ID';

-- Verify deletion:
SELECT COUNT(*) as "remaining_exclusions"
FROM users.self_exclusion
WHERE "userId" = 'YOUR_USER_ID';

-- ==============================================================================
-- SCENARIO 7: GET RECENT SELF-EXCLUSIONS (ALL USERS)
-- ==============================================================================
-- Useful for finding test data or debugging
-- ==============================================================================
SELECT
  id,
  "userId",
  type,
  "platformType",
  "isActive",
  "endDate",
  "postCooldownWindowEnd",
  "removalRequestedAt",
  "createdAt"
FROM users.self_exclusion
ORDER BY "createdAt" DESC
LIMIT 20;

-- ==============================================================================
-- SCENARIO 8: FIND USERS WITH ACTIVE EXCLUSIONS
-- ==============================================================================
SELECT
  se."userId",
  u.username,
  u.email,
  COUNT(*) as "active_exclusions",
  STRING_AGG(se.type::text, ', ') as "exclusion_types"
FROM users.self_exclusion se
JOIN users.users u ON u.id = se."userId"
WHERE se."isActive" = true
GROUP BY se."userId", u.username, u.email
ORDER BY "active_exclusions" DESC;

-- ==============================================================================
-- SCENARIO 9: CREATE TEST COOLDOWN FOR A USER
-- ==============================================================================
-- Creates a new cooldown for testing
-- Replace YOUR_USER_ID with actual user ID
-- ==============================================================================
INSERT INTO users.self_exclusion (
  id,
  "userId",
  type,
  "platformType",
  "startDate",
  "endDate",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',
  'COOLDOWN',
  'PLATFORM',
  NOW(),
  NOW() + INTERVAL '24 hours',
  true,
  NOW(),
  NOW()
);

-- Get the ID of the created cooldown:
SELECT id, type, "endDate"
FROM users.self_exclusion
WHERE "userId" = 'YOUR_USER_ID'
  AND type = 'COOLDOWN'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ==============================================================================
-- SCENARIO 10: CREATE TEST LOSS LIMIT FOR A USER
-- ==============================================================================
-- Creates a new loss limit for testing
-- Replace YOUR_USER_ID with actual user ID
-- Replace 100 with desired limit amount (in dollars)
-- ==============================================================================
INSERT INTO users.self_exclusion (
  id,
  "userId",
  type,
  "platformType",
  period,
  "limitAmount",
  "startDate",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',
  'LOSS_LIMIT',
  'PLATFORM',
  'DAILY',
  100,
  NOW(),
  true,
  NOW(),
  NOW()
);

-- Get the ID of the created limit:
SELECT id, type, period, "limitAmount"
FROM users.self_exclusion
WHERE "userId" = 'YOUR_USER_ID'
  AND type = 'LOSS_LIMIT'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ==============================================================================
-- HELPFUL QUERIES
-- ==============================================================================

-- Count exclusions by type:
SELECT type, COUNT(*) as count, SUM(CASE WHEN "isActive" THEN 1 ELSE 0 END) as active
FROM users.self_exclusion
GROUP BY type
ORDER BY count DESC;

-- Find exclusions in post-cooldown window:
SELECT id, "userId", type, "endDate", "postCooldownWindowEnd"
FROM users.self_exclusion
WHERE "postCooldownWindowEnd" IS NOT NULL
  AND "postCooldownWindowEnd" > NOW()
ORDER BY "postCooldownWindowEnd" ASC;

-- Find exclusions with pending removal:
SELECT id, "userId", type, "removalRequestedAt",
       "removalRequestedAt" + INTERVAL '24 hours' as "expiresAt"
FROM users.self_exclusion
WHERE "removalRequestedAt" IS NOT NULL
ORDER BY "removalRequestedAt" ASC;
