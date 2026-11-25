import { useNews } from "../../api/hooks";
import { EmptyState, ErrorState, Skeleton } from "../../components/states";
import { formatDateTime } from "../../lib/format";

export function NewsPage() {
  const news = useNews();
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Notícias</h1>
        <p className="page-sub">Manchetes da NBA publicadas pela ESPN, em inglês, com link para a matéria original.</p>
      </div>
      {news.isPending ? (
        <Skeleton label="Carregando notícias…" rows={6} variant="cards" />
      ) : news.isError ? (
        <ErrorState error={news.error} onRetry={() => void news.refetch()} title="Não foi possível carregar as notícias" />
      ) : news.data.length === 0 ? (
        <EmptyState title="Sem manchetes agora">A fonte não devolveu notícias. Tente mais tarde.</EmptyState>
      ) : (
        <ul className="news">
          {news.data.map((item) => (
            <li key={item.id} className="news-card">
              {item.image ? <img src={item.image.url} alt="" loading="lazy" decoding="async" width={640} height={360} /> : null}
              <div className="news-body">
                <h2 lang="en">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.headline}
                    <span className="sr"> (abre a ESPN em nova aba)</span>
                  </a>
                </h2>
                {item.description ? <p lang="en">{item.description}</p> : null}
                <p className="news-meta">
                  {item.published ? <time dateTime={item.published}>{formatDateTime(item.published)}</time> : null}
                  {item.byline ? <span lang="en"> · {item.byline}</span> : null}
                  <span className="tag tag-lang">em inglês</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
