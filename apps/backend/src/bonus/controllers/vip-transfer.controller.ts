import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateVipTransferSubmissionDto } from '../dto/create-vip-transfer-submission.dto';
import { VipTransferService } from '../services/vip-transfer.service';

@ApiTags('bonus')
@Controller('bonus/vip-transfer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VipTransferController {
  constructor(private readonly vipTransferService: VipTransferService) {}

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit VIP transfer application' })
  @ApiBody({ type: CreateVipTransferSubmissionDto })
  @ApiResponse({
    status: 201,
    description: 'VIP transfer application submitted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submit(@CurrentUser() user: UserEntity, @Body() dto: CreateVipTransferSubmissionDto) {
    const submission = await this.vipTransferService.create(user.id, dto);
    return {
      id: submission.id,
      message: 'VIP transfer application submitted successfully',
    };
  }
}
