import Image from "next/image";

type Ratio = "4/3" | "3/2" | "3/4" | "2/1" | "1/1";

const RATIO: Record<Ratio, string> = {
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "3/4": "aspect-[3/4]",
  "2/1": "aspect-[2/1]",
  "1/1": "aspect-square",
};

function useNextImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.pathname.startsWith("/static/");
  } catch {
    return false;
  }
}

export function MediaFrame({
  src,
  alt = "",
  ratio = "4/3",
  fit = "contain",
  position = "center",
  pad = true,
  dark = false,
  className = "",
  priority = false,
}: {
  src: string;
  alt?: string;
  ratio?: Ratio;
  fit?: "contain" | "cover";
  position?: string;
  pad?: boolean;
  dark?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const imgClass = `${fit === "cover" ? "object-cover" : "object-contain"} ${
    pad && fit === "contain" ? "p-[5%]" : ""
  }`;

  return (
    <div
      className={`relative overflow-hidden ${RATIO[ratio]} ${
        dark ? "bg-zinc-950 ring-1 ring-white/10" : "bg-neutral-100"
      } ${className}`}
    >
      {useNextImage(src) ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 50vw"
          className={imgClass}
          style={{ objectPosition: position }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full ${imgClass}`}
          style={{ objectPosition: position }}
        />
      )}
    </div>
  );
}
