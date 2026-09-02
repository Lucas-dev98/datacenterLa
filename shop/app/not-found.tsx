import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-4 py-24 md:px-6">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-white/45">404</p>
        <h1 className="mt-4 text-3xl font-semibold">Página não encontrada</h1>
        <p className="mt-4 text-sm text-white/65">O endereço pode estar incorreto ou o conteúdo foi movido.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
            Início
          </Link>
          <Link href="/loja" className="border border-white/40 px-5 py-2.5 text-sm font-medium hover:border-white">
            Ver loja
          </Link>
        </div>
      </div>
    </div>
  );
}
