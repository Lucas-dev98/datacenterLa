import { redirect } from "next/navigation";

/** Cadastro de produtos vive no Catálogo — evita menu duplicado. */
export default function EstoqueCadastroRedirect() {
  redirect("/produtos");
}
