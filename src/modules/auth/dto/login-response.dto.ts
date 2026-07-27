import { OrganizationResponseDto, UserResponseDto } from './auth-response.dto';

export class LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: UserResponseDto;
  organizations?: OrganizationResponseDto[];
}
