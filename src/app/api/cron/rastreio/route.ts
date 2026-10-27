import { NextRequest, NextResponse } from "next/server";
import { conferirRastreios } from "@/lib/rastreio-envios";

export const maxDuration = 60;

/**
 * A cada 30 minutos: pedido mandado pro carrinho do Melhor Envio que já tem
 * etiqueta gerada ganha baixa na Shopify com o código de rastreio.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured. Cron endpoint is disabled.");
    return NextResponse.json(
      { error: "CRON_SECRET not configured. Set this environment variable to enable cron sync." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // folga de 15s para a resposta sair antes do limite da função
    const resumo = await conferirRastreios({ orcamentoMs: 45_000 });
    return NextResponse.json({ success: true, ...resumo });
  } catch (error) {
    console.error("[cron rastreio] erro", error);
    return NextResponse.json(
      { error: "Rastreio failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
