"use server";

type ExchangeRates = {
    BRL: number;
    USD: number;
    EUR: number;
    GBP: number;
};

export async function getExchangeRates(): Promise<ExchangeRates | null> {
    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/BRL", {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error("Failed to fetch exchange rates");
        }

        const data = await response.json();

        return {
            BRL: 1,
            USD: data.rates.USD,
            EUR: data.rates.EUR,
            GBP: data.rates.GBP,
        };
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        return null;
    }
}
