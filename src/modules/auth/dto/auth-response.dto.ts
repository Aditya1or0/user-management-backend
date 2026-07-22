export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

export class OrganizationResponseDto {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export class AuthResponseDto {
  user: UserResponseDto;
  organization: OrganizationResponseDto;
}
