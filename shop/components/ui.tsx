import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-[var(--shop-card)] shadow-sm">
      {title ? (
        <header className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2 sm:py-2 sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none ring-neutral-900 focus:ring-2 sm:py-2 sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-neutral-900 text-white hover:bg-neutral-800"
      : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50";
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    />
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
