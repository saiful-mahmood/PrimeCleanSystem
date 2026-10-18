/** Label/value rows for detail cards. Null or empty values render as an em dash. */
export function DetailList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words">
            {value === null || value === undefined || value === "" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
