import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { RaceLeaderboardDto } from '../../bonus/dto/race-leaderboard.dto';
import { RaceDto } from '../../bonus/dto/race.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateAffiliateRaceInput } from '../dto/create-affiliate-race.input';
import { AffiliateRaceService } from '../services/affiliate-race.service';

class AffiliateRaceListDto {
  @ApiProperty({ type: [RaceLeaderboardDto] })
  races!: RaceLeaderboardDto[];
}

@ApiTags('Affiliate Races')
@Controller('affiliate/races')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AffiliateRaceController {
  constructor(private readonly affiliateRaceService: AffiliateRaceService) {}

  @Post()
  @ApiOperation({
    summary: 'Create affiliate race',
    description: `
Creates a new affiliate race. 

**Important restrictions:**
- User cannot create new race if they already have a race in ACTIVE or PENDING status
- Deducts prize pool from user balance
- Race starts at next hour (rounded up)

**Example response:**
\`\`\`json
{
  "id": "uuid",
  "name": "username's 1-Day Race",
  "status": "PENDING",
  "startsAt": "2024-10-17T12:00:00.000Z",
  "endsAt": "2024-10-18T12:00:00.000Z"
}
\`\`\`
`,
  })
  @ApiResponse({ status: 201, description: 'Race created', type: RaceDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid input, insufficient balance, or existing ACTIVE/PENDING race',
  })
  async createAffiliateRace(
    @CurrentUser() user: UserEntity,
    @Body() input: CreateAffiliateRaceInput,
  ): Promise<RaceDto> {
    return this.affiliateRaceService.createAffiliateRace(user.id, input);
  }

  @Get()
  @ApiOperation({
    summary: 'Get my affiliate races with leaderboards',
    description:
      'Returns your races (max 2) with leaderboards: current PENDING/ACTIVE + last ENDED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Your affiliate races with leaderboards (max 2)',
    type: AffiliateRaceListDto,
  })
  async getMyAffiliateRaces(@CurrentUser() user: UserEntity): Promise<AffiliateRaceListDto> {
    return this.affiliateRaceService.getUserAffiliateRaces(user.id);
  }
}
