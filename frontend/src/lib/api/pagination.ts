export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginationQuery(page: number, limit: number, search = '') {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return `?${params.toString()}`;
}

export async function getAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const pageSize = 50;
  const firstPage = await fetchPage(1, pageSize);
  const results = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.total_pages; page += 1) {
    const nextPage = await fetchPage(page, pageSize);
    results.push(...nextPage.data);
  }

  return results;
}
