"use client";

import { createContext, useContext, useState } from "react";

interface ForecastContextValue {
	forecastYears: number;
	setForecastYears: (years: number) => void;
	forecastMonths: number;
}

const ForecastContext = createContext<ForecastContextValue | null>(null);

export function ForecastProvider({ children }: { children: React.ReactNode }) {
	const [forecastYears, setForecastYears] = useState(1);

	return (
		<ForecastContext.Provider
			value={{
				forecastYears,
				setForecastYears,
				forecastMonths: forecastYears * 12,
			}}
		>
			{children}
		</ForecastContext.Provider>
	);
}

export function useForecast() {
	const ctx = useContext(ForecastContext);
	if (!ctx) throw new Error("useForecast must be used within ForecastProvider");
	return ctx;
}
