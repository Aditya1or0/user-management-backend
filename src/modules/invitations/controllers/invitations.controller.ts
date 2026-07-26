import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InvitationsManagementService } from '../services/invitations-management.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationResponseDto } from '../dto/invitation-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(
    private readonly invitationsManagementService: InvitationsManagementService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.invitationsManagementService.createInvitation(actorId, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUser('id') actorId: string,
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationsManagementService.revokeInvitation(actorId, invitationId);
  }
}
