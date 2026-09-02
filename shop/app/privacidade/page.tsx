import { ShopShell } from "@/components/shop-shell";

export default function PrivacidadePage() {
  return (
    <ShopShell crumbs={[{ label: "Política de privacidade" }]}>
      <h1 className="text-3xl font-semibold tracking-tight">Política de privacidade</h1>
      <div className="prose prose-neutral mt-8 max-w-3xl text-sm leading-relaxed text-neutral-700">
        <p>
          A DATACENTER L.A. trata dados pessoais fornecidos em cotações, checkout e área de pedidos
          apenas para atendimento comercial, cumprimento de contratos e comunicações relacionadas à sua
          compra.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Dados coletados</h2>
        <p>
          Podemos processar nome, e-mail, telefone, documento de identificação, endereço de entrega e
          histórico de pedidos quando você interage com a loja ou solicita contato.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Compartilhamento</h2>
        <p>
          Não vendemos dados pessoais. Informações podem ser compartilhadas com transportadoras,
          processadores de pagamento e autoridades quando exigido por lei.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-neutral-900">Seus direitos</h2>
        <p>
          Para solicitar acesso, correção ou exclusão de dados, entre em contato pelo formulário de
          cotação ou pelo e-mail informado no rodapé do site.
        </p>
      </div>
    </ShopShell>
  );
}
