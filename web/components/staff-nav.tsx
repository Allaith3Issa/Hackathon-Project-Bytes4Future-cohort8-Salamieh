import Link from "@/components/localized-link";

export function StaffNav({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <div className="staff-strip">
      <nav aria-label={label} className="page-wrap flex flex-wrap gap-2 py-2 text-sm sm:text-base">
        {items.map(([href, text]) => (
          <Link key={href} href={href} className="staff-tab">{text}</Link>
        ))}
      </nav>
    </div>
  );
}
