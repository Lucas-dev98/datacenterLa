import { ShopShell } from "@/components/shop-shell";

export default function TermosPage() {
  return (
    <ShopShell crumbs={[{ label: "Termos e condições" }]}>
      <h1 className="text-3xl font-semibold tracking-tight">Termos e condições</h1>
      <div className="prose prose-neutral mt-8 max-w-3xl text-sm leading-relaxed text-neutral-700">
        <p>
          Ao utilizar o site e solicitar cotações da DATACENTER L.A., você concorda com os termos abaixo.
          Este texto é um resumo operacional para o ambiente de demonstração; a versão jurídica definitiva
          deve ser revisada pelo departamento legal da empresa.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Cotações e preços</h2>
        <p>
          Valores exibidos na loja são referenciais em USD e podem variar conforme disponibilidade,
          câmbio, frete e impostos de importação. A proposta formal é enviada após confirmação de estoque
          e condições comerciais.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Pagamentos e entrega</h2>
        <p>
          Prazos de entrega dependem do destino, documentação aduaneira e transportadora. O cliente é
          responsável por fornecer dados corretos para faturamento e envio.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Garantia</h2>
        <p>
          Equipamentos são entregues com garantia conforme especificado na proposta comercial e nota
          fiscal correspondente.
        </p>
      </div>
    </ShopShell>
  );
}
