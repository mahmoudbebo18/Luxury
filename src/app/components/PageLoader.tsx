export function Spinner({ small }: { small?: boolean }) {
  return <span className={small ? 'spinner spinner--sm' : 'spinner'} aria-hidden="true" />;
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-mark">
        <svg aria-hidden="true" style={{ width: 96, aspectRatio: '577 / 172', color: 'var(--gold-500)' }}>
          <use href="/imgs/icons.svg#logo" />
        </svg>
      </span>
      <Spinner />
    </div>
  );
}
