// Icons come from the site sprite (public/imgs/icons.svg).
export function Icon({ name, flip, className }: { name: string; flip?: boolean; className?: string }) {
  return (
    <svg className={['icon', flip && 'icon-flip', className].filter(Boolean).join(' ')} aria-hidden="true">
      <use href={`/imgs/icons.svg#i-${name}`} />
    </svg>
  );
}
