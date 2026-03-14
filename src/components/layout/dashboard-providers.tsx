"use client";

import { ForecastProvider } from "~/context/forecast-context";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
	return <ForecastProvider>{children}</ForecastProvider>;
}
