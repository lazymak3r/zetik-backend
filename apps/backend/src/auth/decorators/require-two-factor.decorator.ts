import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TWO_FACTOR_KEY = 'requireTwoFactor';

export const RequireTwoFactor = () => SetMetadata(REQUIRE_TWO_FACTOR_KEY, true);
