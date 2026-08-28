"use client";

import { useMemo, useState } from "react";
import type { ProductAnalyticsRow } from "@/lib/types";

const CLASS_FILL: Record<string, string> = {
  A: "#059669",
  B: "#d97706",
  C: "#64748b",
};

const W = 900;
const H = 340;
const PAD = { top: 28, right: 52, bottom: 64, left: 48 };

export function AbcParetoChart({
  products,
  metric,
}: {
  products: ProductAnalyticsRow[];
  metric: "revenue" | "quantity";
}) {
  const [hover, setHover] = useState<number | null>(null);

  const rows = products.slice(0, 25);
  const truncated = products.length > rows.length;

  const plot = useMemo(() => {
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const n = Math.max(rows.length, 1);
    const gap = 4;
    const barW = Math.max(8, (innerW - gap * (n + 1)) / n);
    const y = (pct: number) => PAD.top + innerH * (1 - Math.min(pct, 100) / 100);
    const points = rows.map((row, i) => {
      const x = PAD.left + gap + i * (barW + gap) + barW / 2;
      return `${x},${y(row.cumulative_pct)}`;
    });
    return { innerW, innerH, n, gap, barW, y, points: points.join(" ") };
  }, [rows]);

  if (rows.length === 0) return null;

  const hovered = hover != null ? rows[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Barras = participação de cada SKU no {metric === "revenue" ? "faturamento" : "volume"} · linha = acumulado
          Pareto. Linhas em 80% (A) e 95% (B).
        </p>
        <div className="flex gap-3 text-xs text-slate-600">
          <LegendDot color={CLASS_FILL.A} label="Classe A" />
          <LegendDot color={CLASS_FILL.B} label="Classe B" />
          <LegendDot color={CLASS_FILL.C} label="Classe C" />
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-blue-600" />
            Acumulado
          </span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[280px] w-full min-w-[640px]"
          role="img"
          aria-label="Gráfico Pareto da curva ABC"
        >
          <title>Curva ABC Pareto</title>
          {[0, 20, 40, 60, 80, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={plot.y(tick)}
                y2={plot.y(tick)}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={plot.y(tick) + 3} textAnchor="end" fontSize={10} fill="#64748b">
                {tick}%
              </text>
              <text x={W - PAD.right + 8} y={plot.y(tick) + 3} textAnchor="start" fontSize={10} fill="#64748b">
                {tick}%
              </text>
            </g>
          ))}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={plot.y(80)}
            y2={plot.y(80)}
            stroke={CLASS_FILL.A}
            strokeWidth={1.25}
            strokeDasharray="5 4"
          />
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={plot.y(95)}
            y2={plot.y(95)}
            stroke={CLASS_FILL.B}
            strokeWidth={1.25}
            strokeDasharray="5 4"
          />
          <text x={PAD.left + 6} y={plot.y(80) - 5} fontSize={9} fill={CLASS_FILL.A}>
            80% A
          </text>
          <text x={PAD.left + 6} y={plot.y(95) - 5} fontSize={9} fill={CLASS_FILL.B}>
            95% B
          </text>

          {rows.map((row, i) => {
            const x = PAD.left + plot.gap + i * (plot.barW + plot.gap);
            const barH = (Math.min(row.share_pct, 100) / 100) * plot.innerH;
            const y = PAD.top + plot.innerH - barH;
            const active = hover === i;
            return (
              <g key={row.sku_id}>
                <rect
                  x={x}
                  y={PAD.top}
                  width={plot.barW}
                  height={plot.innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                <rect
                  x={x}
                  y={y}
                  width={plot.barW}
                  height={Math.max(barH, 1)}
                  rx={2}
                  fill={CLASS_FILL[row.abc_class] ?? CLASS_FILL.C}
                  opacity={hover == null || active ? 1 : 0.35}
                  pointerEvents="none"
                />
                <text
                  x={x + plot.barW / 2}
                  y={H - 40}
                  textAnchor="end"
                  fontSize={9}
                  fill="#475569"
                  transform={`rotate(-50 ${x + plot.barW / 2} ${H - 40})`}
                >
                  {row.sku_code}
                </text>
              </g>
            );
          })}

          {rows.length > 1 ? (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth={2.25}
              points={plot.points}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {rows.map((row, i) => {
            const x = PAD.left + plot.gap + i * (plot.barW + plot.gap) + plot.barW / 2;
            return (
              <circle
                key={`pt-${row.sku_id}`}
                cx={x}
                cy={plot.y(row.cumulative_pct)}
                r={hover === i ? 4.5 : 3}
                fill="#2563eb"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          <text x={PAD.left} y={H - 8} fontSize={10} fill="#64748b">
            SKU (ranking)
          </text>
          <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize={10} fill="#64748b">
            Acumulado %
          </text>
        </svg>

        {hovered ? (
          <div className="pointer-events-none absolute right-3 top-2 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
            <p className="font-semibold text-slate-900">
              <span className="mr-1.5 font-mono">{hovered.sku_code}</span>
              {hovered.sku_name}
            </p>
            <p className="mt-1 text-slate-600">
              Classe {hovered.abc_class} · share {hovered.share_pct.toFixed(1)}% · acum. {hovered.cumulative_pct.toFixed(1)}%
            </p>
            <p className="text-slate-500">
              {hovered.qty_sold} un. · ${hovered.revenue_usd.toFixed(2)} · margem ${hovered.margin_usd.toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>
      {truncated ? (
        <p className="mt-2 text-xs text-slate-500">Gráfico com os 25 primeiros SKUs; o ranking completo está na tabela.</p>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
