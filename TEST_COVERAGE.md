# Test Coverage Report

**Generated:** 2025-06-06T15:53:04.505Z

## Summary

### Unit Tests

- **Total Tests:** 30
- **Passed:** 29 ✅
- **Failed:** 1 ❌
- **Coverage:** 96.7%

### E2E Tests

- **Total Tests:** 111
- **Passed:** 98 ✅
- **Failed:** 13 ❌
- **Coverage:** 88.3%

### Overall

- **Total Tests:** 141
- **Total Passed:** 127 ✅
- **Total Failed:** 14 ❌

---

## Unit Test Details

### src module

#### admin-panel.controller.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### users.controller.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### currencies.service.spec.ts ❌

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                                        | Status | Feature/Function | Failure Reason |
| ----------------------------------------------------------- | ------ | ---------------- | -------------- |
| CurrenciesService › getAllAssets › should return all assets | ⏭️     | Data Retrieval   | -              |

#### users.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### bet-confirmed-handler.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### mines.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### users.controller.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### crash-websocket.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### auth.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### crash-websocket.integration.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### payments.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### st8.controller.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### bonus-scheduler.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### balance.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### password.util.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### roulette.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### limbo.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### keno.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### blackjack.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### game-session.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### balance-report.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### solana-signature.util.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### bonus-calculation-log.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### crypto-converter.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### telegram-signature.util.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### google-id-token.util.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### get-deposit-address.dto.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### app.controller.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### crash.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### plinko.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### wallet.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### dice.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### auth-phantom.service.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

#### bonus-calculation.processor.spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

## E2E Test Details

### bonus.e2e-spec.ts ❌

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 7

| Test                                                                                                                                                                      | Status | Endpoint/Feature | Failure Reason |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| Console                                                                                                                                                                   | ⏭️     | API Endpoint     | -              |
| at seedVipTiers (../src/seeds/002-initial-vip-tiers.seed.ts:47:13) › BonusController (e2e) › GET /bonus/vip-tiers returns list of tiers                                   | ⏭️     | GET Endpoint     | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › BonusController (e2e) › POST /bonus/test/bet-confirmed emits event and creates pending bonus | ⏭️     | POST Endpoint    | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › BonusController (e2e) › GET /bonus/pending returns pending bonus                             | ⏭️     | GET Endpoint     | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › BonusController (e2e) › GET /bonus/vip-status returns updated VIP status                     | ⏭️     | GET Endpoint     | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › BonusController (e2e) › POST /bonus/claim/:bonusId claims the bonus                          | ⏭️     | POST Endpoint    | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › BonusController (e2e) › GET /bonus/pending returns no pending bonuses after claim            | ⏭️     | GET Endpoint     | -              |

### auth-phantom.e2e-spec.ts ❌

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 2

| Test                                                                                                                                                                         | Status | Endpoint/Feature | Failure Reason |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › Auth Phantom (e2e) › POST /auth/register/phantom › should register with valid phantom signature | ⏭️     | POST Endpoint    | -              |
| at Server.localAssert (../../../node_modules/supertest/lib/test.js:135:14) › Auth Phantom (e2e) › POST /auth/login/phantom › should login with valid phantom signature       | ⏭️     | POST Endpoint    | -              |

### payments.e2e-spec.ts ❌

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 6

| Test                                                                                                                                                                                                        | Status | Endpoint/Feature | Failure Reason |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at async Object.<anonymous> (/Users/alex/workspace/caerus/zetik-backend/apps/backend/test/payments.e2e-spec.ts:28:44) › PaymentsController (e2e) › GET /payments/available-assets should return assets list | ⏭️     | GET Endpoint     | -              |
| at async Object.<anonymous> (payments.e2e-spec.ts:28:44) › PaymentsController (e2e) › GET /payments/deposit-address requires auth and returns address                                                       | ⏭️     | GET Endpoint     | -              |
| at async Object.<anonymous> (payments.e2e-spec.ts:28:44) › PaymentsController (e2e) › GET /payments/wallets returns array                                                                                   | ⏭️     | GET Endpoint     | -              |
| at async Object.<anonymous> (payments.e2e-spec.ts:28:44) › PaymentsController (e2e) › POST /payments/withdraw-requests › should reject negative amount                                                      | ⏭️     | POST Endpoint    | -              |
| at async Object.<anonymous> (payments.e2e-spec.ts:28:44) › PaymentsController (e2e) › POST /payments/withdraw-requests › should reject insufficient balance                                                 | ⏭️     | POST Endpoint    | -              |
| at async Object.<anonymous> (payments.e2e-spec.ts:28:44) › Test suite failed to run                                                                                                                         | ⏭️     | API Endpoint     | -              |

### st8.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

### users.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                            | Status | Endpoint/Feature | Failure Reason |
| ----------------------------------------------- | ------ | ---------------- | -------------- |
| errorName: 'InsufficientBalanceError' › Console | ⏭️     | API Endpoint     | -              |

### games.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                                                                                          | Status | Endpoint/Feature | Failure Reason |
| ------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at async RedisConnection.init (../../../node_modules/bullmq/src/classes/redis-connection.ts:253:22) › Console | ⏭️     | API Endpoint     | -              |

### auth.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

### balance.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                                                                                          | Status | Endpoint/Feature | Failure Reason |
| ------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at async RedisConnection.init (../../../node_modules/bullmq/src/classes/redis-connection.ts:253:22) › Console | ⏭️     | API Endpoint     | -              |

### app.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                                                             | Status | Endpoint/Feature | Failure Reason |
| -------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at processTicksAndRejections (node:internal/process/task_queues:105:5) › Console | ⏭️     | API Endpoint     | -              |

### provider-games.e2e-spec.ts ✅

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 0

### parallel-games.e2e-spec.ts ❌

- **Passed:** 0 | **Failed:** 0 | **Skipped:** 1

| Test                                                                                              | Status | Endpoint/Feature | Failure Reason |
| ------------------------------------------------------------------------------------------------- | ------ | ---------------- | -------------- |
| at processTicksAndRejections (node:internal/process/task_queues:105:5) › Test suite failed to run | ⏭️     | API Endpoint     | -              |

## Failed Tests Analysis
