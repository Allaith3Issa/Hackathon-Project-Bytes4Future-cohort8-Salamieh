import type { PageDto, PageQueryDto } from '../common/pagination.dto';

export async function reportingPage<T>(
  { page, pageSize }: PageQueryDto,
  total: number,
  read: (skip: number, take: number) => Promise<T[]>,
): Promise<PageDto & { items: T[] }> {
  const lastPage = Math.ceil(total / pageSize);
  const items = page > lastPage ? [] : await read((page - 1) * pageSize, pageSize);
  return { items, page, pageSize, total, previousPage: page > 1 ? page - 1 : null,
    nextPage: page < lastPage ? page + 1 : null };
}
