import { redirect } from "next/navigation";

export default function LegacyExpedicaoRedirect() {
  redirect("/estoque/saida/expedicao");
}
