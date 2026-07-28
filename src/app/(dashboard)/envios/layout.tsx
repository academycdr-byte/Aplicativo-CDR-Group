/**
 * Envios fala com duas APIs de fora numa requisição só: sincroniza a Shopify e,
 * no despacho, cota e registra cada pedido no Melhor Envio. O padrão da Vercel
 * cortaria isso no meio, então este segmento pede o teto de 60 segundos.
 */
export const maxDuration = 60;

export default function EnviosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
