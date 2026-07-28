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
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('invitations')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class InvitationsController {
  constructor(
    private readonly invitationsManagementService: InvitationsManagementService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('invitations:create')
  async create(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.invitationsManagementService.createInvitation(actorId, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('invitations:delete')
  async revoke(
    @CurrentUser('id') actorId: string,
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.invitationsManagementService.revokeInvitation(actorId, invitationId);
  }
}
