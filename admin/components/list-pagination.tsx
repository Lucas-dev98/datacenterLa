type ListPaginationProps = {
  offset: number;
  limit: number;
  total: number;
  onPageChange: (nextOffset: number) => void;
};

export function ListPagination({ offset, limit, total, onPageChange }: ListPaginationProps) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
      <p>
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={offset <= 0}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={offset + limit >= total}
          onClick={() => onPageChange(offset + limit)}
          className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
