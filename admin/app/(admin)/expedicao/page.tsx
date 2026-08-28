import { redirect } from "next/navigation";

export default function ExpedicaoLegacyRedirect() {
  redirect("/estoque/saida/expedicao");
}
