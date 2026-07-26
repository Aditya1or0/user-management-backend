import { PaginationMetaDto } from './pagination-meta.dto';

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(data: T[], totalItems: number, page: number, limit: number) {
    this.data = data;
    this.meta = new PaginationMetaDto(totalItems, page, limit, data.length);
  }
}
