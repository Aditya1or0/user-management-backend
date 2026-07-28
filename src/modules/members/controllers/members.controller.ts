import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantOrgGuard } from '../../authorization/guards/tenant-org.guard';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentOrgId } from '../../../common/decorators/current-org.decorator';
import { CurrentOrganization } from '../../../common/decorators/current-organization.decorator';
import { MembersService } from '../services/members.service';
import { MemberQueryDto } from '../dto/member-query.dto';
import { CreateMemberDto } from '../dto/create-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { AuthenticatedUser } from '../../../common/types/authenticated-user.interface';

@Controller('members')
@UseGuards(JwtAuthGuard, TenantOrgGuard, PermissionsGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * GET /members
   * List org members with pagination, search, and status filter.
   */
  @Get()
  @RequirePermissions('members:read')
  findAll(
    @CurrentOrgId() orgId: string,
    @Query() query: MemberQueryDto,
  ) {
    return this.membersService.findAll(orgId, query);
  }

  /**
   * GET /members/:slug
   * Get single member detail by User publicSlug.
   */
  @Get(':slug')
  @RequirePermissions('members:read')
  findOne(
    @Param('slug') slug: string,
    @CurrentOrgId() orgId: string,
  ) {
    return this.membersService.findOneBySlug(slug, orgId);
  }

  /**
   * POST /members
   * Admin-provision a new member directly (no invitation flow).
   * Creates the global User if they don't exist, then creates OrganizationUser.
   */
  @Post()
  @RequirePermissions('members:create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentOrgId() orgId: string,
    @Body() dto: CreateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organization: any,
  ) {
    return this.membersService.create(orgId, dto, user, organization);
  }

  /**
   * PATCH /members/:slug
   * Update member status and/or role assignments.
   */
  @Patch(':slug')
  @RequirePermissions('members:update')
  update(
    @Param('slug') slug: string,
    @CurrentOrgId() orgId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organization: any,
  ) {
    return this.membersService.updateBySlug(slug, orgId, dto, user.id, organization);
  }

  /**
   * DELETE /members/:slug
   * Remove a member from the organization.
   * Cannot remove the organization owner.
   */
  @Delete(':slug')
  @RequirePermissions('members:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('slug') slug: string,
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organization: any,
  ) {
    return this.membersService.removeBySlug(slug, orgId, user.id, organization);
  }
}
