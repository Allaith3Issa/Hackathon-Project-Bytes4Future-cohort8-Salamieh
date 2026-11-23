import Link from "next/link";

export function StaffNav({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <div className="border-b border-rule bg-mauve">
      <nav aria-label={label} className="page-wrap flex flex-wrap gap-1 py-1 text-sm sm:text-base">
        {items.map(([href, text]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-white">{text}</Link>
        ))}
      </nav>
    </div>
  );
}
