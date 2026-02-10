# Ajustes - Aba Financeiro

> **Modelo:** Claude Opus 4.6
> **Escopo:** Apenas a aba lateral FINANCEIRO (`/financeiro`)
> **Prioridade:** Executar na ordem listada (1, 2, 3)

---

## Contexto do Projeto

- **Stack:** Next.js 16 + TypeScript + Prisma + PostgreSQL + Tailwind + shadcn/ui
- **Arquivos principais da aba Financeiro:**
  - `src/app/(dashboard)/financeiro/page.tsx` - Pagina principal
  - `src/components/finance/financial-config-dialog.tsx` - Popup de taxas
  - `src/components/finance/product-cost-table.tsx` - Tabela de custos de produto
  - `src/actions/finance.ts` - Server actions (calculo financeiro)
  - `prisma/schema.prisma` - Models: `FinancialConfig`, `ProductCost`

---

## AJUSTE 1: Recalculo imediato ao salvar taxas

### Problema
Quando o usuario preenche as taxas no popup "Configurar Taxas" (`FinancialConfigDialog`) e clica em "Salvar Alteracoes", o dialog fecha mas os dados financeiros na pagina **NAO atualizam**. O usuario precisa trocar o periodo ou dar refresh na pagina para ver os novos calculos. Isso causa uma percepcao de lentidao/delay.

### Causa raiz
Em `financial-config-dialog.tsx` linha 46, ao salvar, o dialog simplesmente fecha com `setIsOpen(false)`. Nao existe callback para notificar o componente pai (`FinancePage`) de que a config mudou. A funcao `loadData()` em `page.tsx` (linhas 60-99) so e chamada quando `period` muda (dependencia do `useCallback` na linha 99). O `revalidatePath("/financeiro")` na server action (finance.ts linha 286) so invalida cache server-side, nao o state client-side.

### Solucao exigida

1. **No `FinancialConfigDialog` (`financial-config-dialog.tsx`):**
   - Adicionar uma prop `onSave?: () => void` no componente
   - No `handleSave`, apos o `toast.success` e antes do `setIsOpen(false)`, chamar `onSave?.()`

2. **No `FinancePage` (`financeiro/page.tsx`):**
   - Passar a funcao `loadData` como callback para o `FinancialConfigDialog` via prop `onSave`
   - Onde esta `<FinancialConfigDialog config={config} />` (linha 130), mudar para: `<FinancialConfigDialog config={config} onSave={loadData} />`

### Resultado esperado
Ao clicar "Salvar Alteracoes" no popup de taxas, os cards financeiros (Receita Bruta, Gateway, Checkout, Impostos, Lucro Liquido, etc.) devem atualizar **imediatamente** sem precisar trocar periodo ou dar refresh. Mostrar loading skeleton durante o recalculo.

---

## AJUSTE 2: Novo sistema de CMV (Custo de Mercadoria Vendida)

### Problema atual
O CMV so funciona via matching de SKU (`product-cost-table.tsx` + `finance.ts` linhas 113-153). O usuario precisa cadastrar cada produto individualmente por SKU e o sistema tenta casar com `rawData.line_items[].sku` dos pedidos. Isso e impratico para muitos lojistas.

### Solucao exigida - Duas novas formas de calcular CMV

O usuario quer **duas opcoes alternativas** alem do SKU matching existente:

#### Opcao A: Custo Medio por Pedido
- O usuario define um **valor medio de custo por pedido** (ex: R$ 45,00)
- O sistema multiplica esse valor pela **quantidade de pedidos no periodo** (dado ja existe: `metrics.orderCount`)
- Formula: `CMV = custoMedioPorPedido * quantidadeDePedidos`
- Exemplo: custo medio R$ 45 x 200 pedidos = CMV de R$ 9.000

#### Opcao B: Pagamentos ao Fornecedor (Controle Manual)
- O usuario registra **pagamentos feitos ao fornecedor** com data e valor
- Exemplo: "Paguei R$ 15.000 ao fornecedor dia 05/01", "Paguei R$ 8.000 dia 20/01"
- O CMV do periodo e a **soma dos pagamentos registrados dentro do range de datas selecionado**
- Isso funciona como um controle de fluxo de caixa de mercadoria

### Implementacao tecnica

#### 2.1 - Schema do Prisma (schema.prisma)

Adicionar ao model `FinancialConfig`:
```prisma
cmvMethod String @default("sku") // "sku" | "average" | "supplier_payments"
averageCostPerOrder Decimal @db.Decimal(10, 2) @default(0)
```

Criar novo model para pagamentos ao fornecedor:
```prisma
model SupplierPayment {
  id             String       @id @default(cuid())
  organizationId String
  amount         Decimal      @db.Decimal(10, 2)
  description    String?
  paymentDate    DateTime
  createdAt      DateTime     @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("supplier_payments")
}
```

Lembrar de adicionar a relation em `Organization`:
```prisma
supplierPayments SupplierPayment[]
```

Rodar `npx prisma db push` apos alterar o schema.

#### 2.2 - Server Actions (finance.ts)

**Atualizar `getFinancialMetrics`** para suportar os 3 metodos de CMV:

```typescript
// Dentro de getFinancialMetrics, substituir o calculo de COGS atual:

let cogs = 0;

if (config.cmvMethod === "average") {
  // Opcao A: Custo medio * quantidade de pedidos
  cogs = Number(config.averageCostPerOrder) * orders.length;

} else if (config.cmvMethod === "supplier_payments") {
  // Opcao B: Soma dos pagamentos ao fornecedor no periodo
  const payments = await db.supplierPayment.aggregate({
    where: {
      organizationId,
      paymentDate: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });
  cogs = Number(payments._sum.amount || 0);

} else {
  // Metodo padrao "sku": matching por SKU (codigo atual)
  // ... manter logica existente de costMap e loop de orders ...
}
```

**Criar novas server actions:**

```typescript
// Salvar pagamento ao fornecedor
export async function saveSupplierPayment(input: {
  amount: number;
  description?: string;
  paymentDate: Date;
}) { ... }

// Listar pagamentos ao fornecedor
export async function getSupplierPayments(from: Date, to: Date) { ... }

// Deletar pagamento ao fornecedor
export async function deleteSupplierPayment(id: string) { ... }
```

**Atualizar `saveFinancialConfig`** para incluir os novos campos `cmvMethod` e `averageCostPerOrder`.

#### 2.3 - UI: Popup de Config (financial-config-dialog.tsx)

Adicionar ao dialog um seletor de metodo de CMV com 3 opcoes (radio buttons ou select):

1. **"Por SKU (atual)"** (`sku`) - Mostra: "Configure custos na tabela de produtos abaixo"
2. **"Custo Medio por Pedido"** (`average`) - Mostra: input para digitar o valor medio (R$)
3. **"Pagamentos ao Fornecedor"** (`supplier_payments`) - Mostra: "Registre pagamentos na secao abaixo"

Quando o metodo for "average", exibir campo de input para `averageCostPerOrder`.

Adicionar as props `cmvMethod` e `averageCostPerOrder` ao tipo `FinancialConfig` do componente e ao `handleSave`.

#### 2.4 - UI: Secao de Pagamentos ao Fornecedor (financeiro/page.tsx)

Quando `cmvMethod === "supplier_payments"`, exibir uma nova secao (Card) na pagina do Financeiro:

- **Titulo:** "Pagamentos ao Fornecedor"
- **Botao:** "Registrar Pagamento" (abre dialog com campos: Valor R$, Descricao, Data)
- **Tabela:** Lista de pagamentos no periodo selecionado (Data | Descricao | Valor | Acoes)
- **Acoes:** Botao de deletar pagamento
- **Total:** Exibir soma total dos pagamentos do periodo no rodape da tabela

Criar o componente `src/components/finance/supplier-payment-table.tsx` para esta tabela.

#### 2.5 - Ajustes visuais na pagina

- Quando o metodo de CMV for `sku`, mostrar a tabela de ProductCost (comportamento atual)
- Quando o metodo for `average`, esconder a tabela de ProductCost (nao faz sentido mostrar)
- Quando o metodo for `supplier_payments`, mostrar a tabela de SupplierPayment no lugar da ProductCost

### Resultado esperado
O usuario pode escolher entre 3 formas de calcular CMV:
1. Matching por SKU (atual, para quem cadastra produto a produto)
2. Custo medio multiplicado pela qtd de pedidos (simples e rapido)
3. Controle de pagamentos ao fornecedor (para quem paga lotes ao fornecedor)

---

## AJUSTE 3: Corrigir Receita Bruta

### Problema
A "Receita Bruta" na aba Financeiro esta mostrando um valor **diferente** da "Receita Total" que aparece em outras abas (Sales, Dashboard). Os valores nao batem.

### Causa raiz - Filtros de status diferentes

| Pagina | Arquivo | Filtro de Status | Comportamento |
|--------|---------|------------------|---------------|
| **Financeiro** | `finance.ts:93` | `status: { notIn: ["cancelled", "refunded"] }` | Inclui pedidos `pending` + `paid` + `partially_refunded` |
| **Sales** | `sales.ts:13` | `status: { in: ["paid", "partially_refunded"] }` | So pedidos pagos ou parcialmente reembolsados |
| **Dashboard** | `dashboard.ts:33` | `status: "paid"` | So pedidos 100% pagos |

O Financeiro esta **inflando** a receita ao incluir pedidos com status `pending` (que ainda nao foram pagos). A receita real da loja sao os pedidos efetivamente pagos.

### Solucao exigida

**Em `finance.ts`, funcao `getFinancialMetrics` (linha 89-102):**

Alterar o filtro de status dos pedidos para usar o **mesmo filtro da pagina Sales**, que representa a receita real recebida pela loja:

```typescript
// ANTES (inclui pending - ERRADO):
status: { notIn: ["cancelled", "refunded"] }

// DEPOIS (apenas pagos - CORRETO):
status: { in: ["paid", "partially_refunded"] }
```

Isso garante que:
- A Receita Bruta do Financeiro = Receita Total do Sales (para o mesmo periodo)
- Pedidos `pending` nao inflam a receita
- Pedidos `partially_refunded` continuam contando (pagamento parcial recebido)

### Resultado esperado
O card "Receita Bruta" na aba Financeiro deve exibir exatamente o mesmo valor que o card "Receita Total" na aba Sales, para o mesmo periodo selecionado.

---

## Checklist de Execucao

- [ ] **Ajuste 1:** Callback `onSave` no dialog de taxas + recalculo imediato
- [ ] **Ajuste 2.1:** Schema Prisma - novos campos em FinancialConfig + model SupplierPayment
- [ ] **Ajuste 2.2:** Server actions atualizadas para 3 metodos de CMV
- [ ] **Ajuste 2.3:** UI do dialog de config com seletor de metodo CMV
- [ ] **Ajuste 2.4:** Componente SupplierPaymentTable
- [ ] **Ajuste 2.5:** Logica de exibicao condicional das tabelas na pagina
- [ ] **Ajuste 3:** Corrigir filtro de status na query de receita
- [ ] Rodar `npx prisma db push` apos mudancas no schema
- [ ] Rodar `npm run typecheck` para verificar tipos
- [ ] Rodar `npm run lint` para verificar estilo
- [ ] Testar manualmente os 3 cenarios de CMV
- [ ] Verificar que Receita Bruta = Receita Total do Sales

---

## Regras de implementacao

1. **Imports absolutos** - Usar sempre `@/` e nunca `../`
2. **Sem `any`** - Tipar tudo corretamente
3. **Seguir padroes existentes** - Manter o mesmo estilo visual (shadcn/ui, Tailwind classes, icones lucide-react)
4. **Manter compatibilidade** - O metodo `sku` de CMV deve continuar funcionando exatamente como antes (e o padrao)
5. **Loading states** - Mostrar loading skeletons durante recalculos
6. **Error handling** - Toast de erro em caso de falha, try/catch em todas as actions
7. **Commits** - Usar conventional commits: `feat:`, `fix:`
