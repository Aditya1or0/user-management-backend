export class PaginationMetaDto {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;

  constructor(totalItems: number, page: number, limit: number, itemCount: number) {
    this.totalItems = totalItems;
    this.itemCount = itemCount;
    this.itemsPerPage = limit;
    this.totalPages = Math.ceil(totalItems / limit) || 0;
    this.currentPage = page;
  }
}
