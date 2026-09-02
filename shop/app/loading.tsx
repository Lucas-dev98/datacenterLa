export default function RootLoading() {
  return (
    <div className="animate-pulse px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-10 w-2/3 max-w-md rounded bg-white/10" />
        <div className="h-4 w-full max-w-xl rounded bg-white/10" />
        <div className="h-4 w-5/6 max-w-lg rounded bg-white/10" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  );
}
