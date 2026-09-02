import Link from "next/link";
import type { ComponentProps } from "react";

type CtaLinkProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary: "bg-white text-black hover:bg-white/90",
  secondary: "border border-white/80 bg-transparent text-white hover:bg-white/10",
  ghost: "border border-white/30 text-white/80 hover:border-white hover:text-white",
};

export function CtaLink({ variant = "primary", className = "", ...props }: CtaLinkProps) {
  return (
    <Link
      {...props}
      className={`inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-sm font-medium transition ${variants[variant]} ${className}`}
    />
  );
}
