type Props = {
  loading: boolean;
  error: string | null;
  hint: string;
  productCount: number;
  onRetry: () => void;
};

export function CatalogBanner({ loading, error, hint, productCount, onRetry }: Props) {
  if (loading) {
    return <p className="catalog-banner catalog-banner--loading">Đang tải sản phẩm từ API…</p>;
  }
  if (error) {
    return (
      <div className="catalog-banner catalog-banner--error">
        <p>{error}</p>
        <button type="button" onClick={onRetry}>
          Tải lại sản phẩm
        </button>
      </div>
    );
  }
  if (productCount === 0) {
    return (
      <div className="catalog-banner catalog-banner--warn">
        <p>Chưa có sản phẩm. Admin cần cấu hình API đúng (tab Cấu hình).</p>
        <button type="button" onClick={onRetry}>
          Tải lại
        </button>
      </div>
    );
  }
  if (hint) {
    return <p className="catalog-banner catalog-banner--ok muted">{hint}</p>;
  }
  return null;
}
