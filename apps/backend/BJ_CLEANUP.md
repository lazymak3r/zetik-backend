# Technical Debt & Cleanup Tasks

This file tracks technical debt and cleanup tasks that should be addressed in future development cycles.

## Dead Code to Remove

### BlackjackUtilsService (High Priority)

- **File**: `src/games/blackjack/services/blackjack-utils.service.ts`
- **Status**: Completely unused - no injection or method calls anywhere in codebase
- **Issue**: This service is registered in `blackjack.module.ts` but never used by any other service
- **Test File**: `src/games/blackjack/tests/services/blackjack-utils.service.spec.ts`
- **Action Required**:
  1. Remove service from `blackjack.module.ts`
  2. Delete `blackjack-utils.service.ts`
  3. Delete `blackjack-utils.service.spec.ts`
- **Note**: Main validation logic is properly implemented in `BlackjackService.validateBetAmountWithType()` which uses `GameConfigService` for database-configured limits

### Related Cleanup

- Review other `*-utils.service.ts` files to ensure they're actually being used
- Consider consolidating utility functions into a shared utils module if needed

## Code Quality Improvements

### Hybrid Testing Approach (Medium Priority)

- **Current State**: All tests use mocked services via `createTestProviders()`
- **Target State**: Unit tests with mocks + Integration tests with real test database
- **Files to Update**: Most `*.spec.ts` files
- **Action Required**: Create separate `.integration.spec.ts` files that use real database connections

### Validation Architecture (Low Priority)

- **Current State**: Validation logic scattered across services
- **Target State**: Centralized validation using `GameConfigService`
- **Note**: Already implemented correctly in main services, just cleanup needed

---

**Last Updated**: 2025-08-26
**Priority**: High (dead code removal), Medium (testing), Low (validation cleanup)
