import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { fetchProductServer } from "@/lib/server-api";

type PageProps = {
  params: Promise<{ sku: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sku } = await params;
  const product = await fetchProductServer(sku);
  if (!product) {
    return { title: "Produto não encontrado — DATACENTER L.A." };
  }
  return {
    title: `${product.name} — DATACENTER L.A.`,
    description: product.description ?? `${product.name} · SKU ${product.sku_code}`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { sku } = await params;
  const product = await fetchProductServer(sku);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
