export function Field({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="text-sm text-danger">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
