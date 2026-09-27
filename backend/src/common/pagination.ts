export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function normalizePagination(
  requestedPage: number | string = 1,
  requestedLimit: number | string = 8,
) {
  const pageValue = Number(requestedPage);
  const limitValue = Number(requestedLimit);
  const page = Number.isFinite(pageValue) && pageValue >= 1 ? Math.floor(pageValue) : 1;
  const limit = Number.isFinite(limitValue) && limitValue >= 1 ? Math.min(Math.floor(limitValue), 50) : 8;

  return { page, limit };
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
