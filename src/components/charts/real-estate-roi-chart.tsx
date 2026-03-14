"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "~/lib/forecasting";
import type { RealEstateProjectionPoint } from "~/lib/real-estate-forecasting";

interface Props {
  data: RealEstateProjectionPoint[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RealEstateProjectionPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold text-sm">Year {d.year}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">ROI</span>
        <span className="font-medium">{d.roiPercent.toFixed(1)}%</span>
        <span className="text-muted-foreground">Property Value</span>
        <span className="font-medium">{formatCurrency(d.projectedPropertyValue)}</span>
        <span className="text-muted-foreground">Loan Balance</span>
        <span className="font-medium">{formatCurrency(d.projectedLoanBalance)}</span>
        <span className="text-muted-foreground">Equity</span>
        <span className="font-medium">{formatCurrency(d.projectedEquity)}</span>
        <span className="text-muted-foreground">Annual Cash Flow</span>
        <span className={d.annualCashFlow >= 0 ? "font-medium text-green-600" : "font-medium text-red-500"}>
          {formatCurrency(d.annualCashFlow)}
        </span>
        <span className="text-muted-foreground">Cumulative Cash Flow</span>
        <span className={d.cumulativeCashFlow >= 0 ? "font-medium text-green-600" : "font-medium text-red-500"}>
          {formatCurrency(d.cumulativeCashFlow)}
        </span>
        <span className="text-muted-foreground">Total Gain</span>
        <span className="font-medium">{formatCurrency(d.totalGain)}</span>
        <span className="text-muted-foreground">Cash Invested</span>
        <span className="font-medium">{formatCurrency(d.totalCashInvested)}</span>
      </div>
    </div>
  );
}

export function RealEstateRoiChart({ data }: Props) {
  if (!data.length) return null;

  return (
    <ResponsiveContainer height={200} width="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="roiGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `Yr ${v}`}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          baseValue="dataMin"
          dataKey="roiPercent"
          dot={{ r: 3 }}
          fill="url(#roiGradient)"
          name="ROI %"
          stroke="#3b82f6"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
