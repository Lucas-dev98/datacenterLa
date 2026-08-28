type Ratio = "4/3" | "3/2" | "3/4" | "2/1" | "1/1";

const RATIO: Record<Ratio, string> = {
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "3/4": "aspect-[3/4]",
  "2/1": "aspect-[2/1]",
  "1/1": "aspect-square",
};

export function MediaFrame({
  src,
  alt = "",
  ratio = "4/3",
  fit = "contain",
  position = "center",
  pad = true,
  dark = false,
  className = "",
}: {
  src: string;
  alt?: string;
  ratio?: Ratio;
  fit?: "contain" | "cover";
  position?: string;
  pad?: boolean;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${RATIO[ratio]} ${
        dark ? "bg-zinc-950 ring-1 ring-white/10" : "bg-neutral-100"
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${
          pad && fit === "contain" ? "p-[5%]" : ""
        }`}
        style={{ objectPosition: position }}
      />
    </div>
  );
}
