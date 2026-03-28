# Plano de Ação — Product Requirements Document (PRD)

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-03-27 | 1.0 | Versão inicial do PRD | Orion (AIOS Master) |

---

## 1. Goals

- **Automatizar a criação de planos de ação** que hoje leva 30-40 minutos, reduzindo para menos de 10 minutos
- **Centralizar métricas dos últimos 30 dias** (Meta Ads + plataforma de e-commerce) em um único lugar com dados reais já integrados no app
- **Permitir documentar Gaps e Alavancas** com estrutura visual de árvore (título → raízes → sub-itens), reproduzindo o formato de mind-map já utilizado pela equipe CDR
- **Gerar uma apresentação HTML profissional** para apresentar em call com o cliente
- **Disponibilizar link público** para o cliente acessar o plano depois da call
- **Manter histórico** de todos os planos criados por organização

## 2. Background Context

A CDR Group é uma assessoria de performance full-service para e-commerces. Parte do processo de atendimento ao cliente envolve a criação periódica de **Planos de Ação** — documentos que analisam as métricas recentes do cliente, identificam gargalos (Gaps) e propõem alavancas de crescimento.

Hoje esse processo é feito manualmente: o analista abre o Meta Ads, puxa métricas, abre a plataforma do cliente (Shopify/Nuvemshop/etc.), compila dados num mapa mental, e monta uma apresentação. Leva entre 30 e 40 minutos por cliente.

O **Aplicativo CDR Group** (app.cdrgroup.com.br) já possui todas as integrações necessárias — Meta Ads (Facebook Ads), Shopify, Nuvemshop, Cartpanda, Yampi — com dados sincronizados automaticamente. A feature "Plano de Ação" vai aproveitar esses dados já existentes para automatizar a coleta de métricas e focar o tempo do analista no que importa: análise estratégica (Gaps e Alavancas).

---

## 3. Requirements

### 3.1 Functional Requirements

**Navegação & Acesso**

- **FR1:** Nova aba "Plano de Ação" no sidebar, posicionada logo abaixo de "Dashboard", no grupo "CDR AI". Ícone adequado (ex: ClipboardList ou Target do Lucide)
- **FR2:** Somente usuários com role OWNER ou ADMIN podem criar e editar planos de ação. Usuários CLIENT podem visualizar planos da sua organização (somente leitura)
- **FR3:** A aba deve ser visível para todos os roles (OWNER, ADMIN, MEMBER, CLIENT), mas as ações de criação/edição ficam restritas a OWNER/ADMIN

**Listagem & CRUD**

- **FR4:** Página de listagem (`/plano-de-acao`) exibindo todos os planos da organização com: título, data de criação, período analisado, status (Rascunho/Finalizado), e ações (editar, visualizar, copiar link público, excluir)
- **FR5:** Botão "Novo Plano de Ação" que inicia o fluxo de criação
- **FR6:** Ao criar um novo plano, o sistema deve solicitar: título do plano e período de análise (default: últimos 30 dias a partir da data atual)
- **FR7:** Planos podem ter status **Rascunho** (editável, não visível ao cliente) ou **Finalizado** (visível ao cliente, link público ativo)

**Métricas Automáticas**

- **FR8:** Ao criar o plano, o sistema deve puxar automaticamente as seguintes métricas do período selecionado, usando dados já sincronizados no banco:
  - **Faturamento Pago** — soma de `Order.totalAmount` (pedidos pagos) no período
  - **Valor Investido** — soma de `AdMetric.spend` (plataforma FACEBOOK_ADS) no período
  - **Valor Convertido** — soma de `AdMetric.revenue` (plataforma FACEBOOK_ADS) no período
  - **ROAS** — Valor Convertido / Valor Investido
  - **CPA** — Valor Investido / soma de `AdMetric.conversions` no período
  - **Ticket Médio** — Faturamento Pago / número de pedidos pagos no período
- **FR9:** Top 5 Produtos mais vendidos no período — extraídos dos line items de `Order.rawData`, ordenados por quantidade vendida. Exibir: nome do produto, quantidade vendida, faturamento gerado
- **FR10:** Top 3 Coleções com mais vendas no período — extraídas dos line items de `Order.rawData` (campo collection/category quando disponível na rawData da plataforma). Se a plataforma não fornecer coleção nos dados do pedido, permitir preenchimento manual
- **FR11:** Top 5 Criativos com melhor performance — agregados de `AdMetric` agrupados por `adId`, ranqueados por score composto com pesos iguais:
  - Score = (ROAS_normalizado + Vendas_normalizado + Gasto_normalizado) / 3
  - Normalização min-max para cada métrica (0 a 1)
  - Exibir: thumbnail do criativo (campo `thumbnailUrl`), nome/ID, Gasto, Vendas, ROAS, Score

**Gaps (Gargalos)**

- **FR12:** Seção "Gaps" no plano de ação onde o ADMIN pode adicionar gargalos identificados
- **FR13:** Cada Gap tem um **título** (ex: "Instagram", "Site", "Google Ads") e uma estrutura de **raízes** em árvore com pelo menos 3 níveis de profundidade:
  - Nível 1: Área (ex: "Bio", "Feed", "Destaques")
  - Nível 2: Ponto específico (ex: "Mais clareza no objetivo da página")
  - Nível 3: Detalhe/exemplo (ex: "A maior loja de camisas de time do Brasil")
- **FR14:** Interface de árvore interativa para adicionar, editar, reordenar e remover nós em qualquer nível
- **FR15:** Possibilidade de adicionar múltiplos Gaps por plano

**Alavancas**

- **FR16:** Seção "Alavancas" no plano de ação com a mesma estrutura de árvore dos Gaps
- **FR17:** Cada Alavanca tem um **título** e **raízes** com a mesma profundidade e funcionalidade dos Gaps (FR13-FR15)
- **FR18:** Possibilidade de adicionar múltiplas Alavancas por plano

**Edição Manual**

- **FR19:** Todas as métricas auto-populadas (FR8-FR11) devem ser editáveis manualmente pelo ADMIN antes de finalizar o plano
- **FR20:** Os Top 5 Produtos, Top 3 Coleções e Top 5 Criativos devem permitir edição (alterar valores, adicionar/remover itens, reordenar)
- **FR21:** Os Gaps e Alavancas são 100% manuais (preenchidos pelo ADMIN)

**Apresentação & Compartilhamento**

- **FR22:** Botão "Gerar Apresentação" que renderiza o plano completo como uma página HTML estilizada, profissional, pronta para apresentar em call (tela cheia, visual de slide/landing page)
- **FR23:** A apresentação deve conter todas as seções: métricas do período, top produtos, top coleções, top criativos, gaps (visual de árvore/mind-map), alavancas (visual de árvore/mind-map)
- **FR24:** Link público compartilhável com token seguro (ex: `/plano/abc123def456`) acessível sem autenticação. O link só fica ativo quando o plano está com status "Finalizado"
- **FR25:** O cliente logado no app pode visualizar seus planos finalizados na aba "Plano de Ação" (somente leitura)
- **FR26:** Botão de copiar link público para a clipboard com feedback visual (toast)

**Persistência & Histórico**

- **FR27:** Todos os planos ficam salvos no banco de dados vinculados à organização
- **FR28:** Listagem com filtro por status (Rascunho/Finalizado) e ordenação por data

**Integridade do Sistema**

- **FR29:** Nenhuma funcionalidade existente do aplicativo pode ser impactada ou parar de funcionar com a adição desta feature. A nova feature deve ser completamente isolada e aditiva

### 3.2 Non-Functional Requirements

- **NFR1:** Tempo de carregamento das métricas automáticas < 5 segundos
- **NFR2:** Apresentação HTML responsiva (desktop para apresentação em call + mobile para o cliente acessar depois)
- **NFR3:** Link público deve usar token aleatório seguro (UUID v4 ou nanoid), nunca ID sequencial
- **NFR4:** Dados financeiros sensíveis (como margem de lucro) NÃO devem ser expostos na apresentação pública — apenas as métricas listadas no FR8
- **NFR5:** A feature deve seguir os mesmos padrões de código do app existente (Server Actions, shadcn components, Tailwind CSS)
- **NFR6:** Schema Prisma deve manter compatibilidade com o banco existente (migration aditiva, sem alteração de tabelas existentes)
- **NFR7:** Testes de regressão: garantir que todas as rotas existentes continuam funcionando após o deploy

---

## 4. User Interface Design Goals

### 4.1 Overall UX Vision

Interface limpa e funcional que prioriza a **velocidade de criação** do plano. O ADMIN deve conseguir criar um plano completo em menos de 10 minutos: métricas vêm automaticamente, ele só preenche Gaps e Alavancas manualmente.

### 4.2 Key Interaction Paradigms

- **Auto-populate + Edit:** Métricas carregam automaticamente mas são editáveis inline
- **Tree Builder:** Interface de árvore para Gaps e Alavancas com adicionar/editar/remover nós via clique
- **Preview → Finalize:** O ADMIN pode visualizar a apresentação antes de finalizar e gerar o link público
- **Copy Link:** Um clique para copiar o link público

### 4.3 Core Screens and Views

1. **Lista de Planos** (`/plano-de-acao`) — Cards ou tabela com todos os planos, filtros, botão "Novo Plano"
2. **Editor do Plano** (`/plano-de-acao/[id]`) — Formulário com seções colapsáveis: Métricas, Top Produtos, Top Coleções, Top Criativos, Gaps, Alavancas. Barra lateral ou topo com ações (Salvar Rascunho, Visualizar, Finalizar)
3. **Apresentação Pública** (`/plano/[token]`) — Página full-screen estilizada, visual profissional com a marca CDR. Seções fluem verticalmente como uma landing page/one-pager

### 4.4 Accessibility

WCAG AA — contraste adequado, navegação por teclado na árvore de gaps/alavancas

### 4.5 Branding

Seguir o design system já existente no app (Tailwind CSS + shadcn + tema dark/light). A apresentação pública deve ter visual premium condizente com a marca CDR Group (cores, tipografia, espaçamento generoso).

### 4.6 Target Platforms

Web Responsive — otimizado para desktop (editor e apresentação em call) com suporte mobile (cliente acessando o link público depois)

---

## 5. Technical Assumptions

### 5.1 Repository Structure

Monorepo — feature adicionada ao repositório existente `Aplicativo-CDR-Group`

### 5.2 Service Architecture

Monolith (Next.js App Router) — mesma arquitetura do app existente:
- **Frontend:** React 19 + Tailwind 4 + shadcn components
- **Backend:** Server Actions (pasta `src/actions/`)
- **Database:** PostgreSQL (Neon) via Prisma 6
- **Auth:** NextAuth v5 com JWT
- **Deploy:** Vercel

### 5.3 Database Design

Novos modelos Prisma (aditivos, sem alterar modelos existentes):

```prisma
model ActionPlan {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  title          String
  periodStart    DateTime
  periodEnd      DateTime
  status         ActionPlanStatus @default(DRAFT)
  publicToken    String   @unique @default(cuid())

  // Métricas (editáveis, inicialmente auto-populated)
  metrics        Json     // { faturamento, investido, convertido, roas, cpa, ticketMedio }
  topProducts    Json     // [{ name, quantity, revenue }]
  topCollections Json     // [{ name, quantity, revenue }]
  topCreatives   Json     // [{ adId, name, thumbnailUrl, spend, sales, roas, score }]

  // Gaps e Alavancas (estrutura de árvore em JSON)
  gaps           Json     @default("[]") // [{ title, children: [{ text, children: [...] }] }]
  levers         Json     @default("[]") // [{ title, children: [{ text, children: [...] }] }]

  createdById    String
  createdBy      User     @relation(fields: [createdById], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

enum ActionPlanStatus {
  DRAFT
  FINALIZED
}
```

**Decisão: JSON vs tabelas separadas** — Gaps e Alavancas armazenados como JSON dentro do ActionPlan para simplificar a estrutura de árvore com profundidade variável. Métricas também em JSON para permitir edição manual sem rigidez de schema. Trade-off aceito: não é possível fazer queries SQL diretas nos itens de gaps/alavancas, mas isso não é um requisito.

### 5.4 Fontes de Dados para Auto-Populate

| Métrica | Fonte no Banco | Query |
|---------|---------------|-------|
| Faturamento Pago | `Order` (status paid) | `SUM(totalAmount) WHERE orderDate BETWEEN start AND end` |
| Valor Investido | `AdMetric` (platform FACEBOOK_ADS) | `SUM(spend) WHERE date BETWEEN start AND end` |
| Valor Convertido | `AdMetric` (platform FACEBOOK_ADS) | `SUM(revenue) WHERE date BETWEEN start AND end` |
| ROAS | Calculado | `convertido / investido` |
| CPA | Calculado | `investido / SUM(conversions)` |
| Ticket Médio | Calculado | `faturamento / COUNT(orders)` |
| Top Produtos | `Order.rawData` | Parse line_items, aggregate by product name |
| Top Coleções | `Order.rawData` | Parse line_items, aggregate by collection (se disponível) |
| Top Criativos | `AdMetric` | Group by adId, compute composite score |

### 5.5 Testing Requirements

- Testes de regressão nas rotas existentes (sidebar, dashboard, ads, integrations)
- Teste de criação/edição/finalização de plano
- Teste de acesso público (sem auth)
- Teste de permissões (CLIENT não pode editar, ADMIN pode)

### 5.6 Additional Technical Assumptions

- A feature usa `@dnd-kit` (já instalado) para reordenação de itens na árvore de gaps/alavancas
- A apresentação pública é uma rota Next.js fora do grupo `(dashboard)` para não exigir autenticação
- O `publicToken` é gerado com `nanoid` ou `cuid()` para segurança
- Framer Motion (já instalado) para animações na apresentação pública
- Recharts (já instalado) pode ser usado para gráficos na apresentação se necessário

---

## 6. Epic List

### Epic 1: Plano de Ação — Core (Backend + CRUD + Métricas)
Estabelecer a infraestrutura de dados, navegação, e o fluxo completo de criação de planos com métricas automáticas, Gaps, Alavancas, e edição manual.

### Epic 2: Apresentação HTML & Compartilhamento
Gerar a apresentação visual profissional, implementar o link público compartilhável, e garantir acesso pelo cliente logado.

---

## 7. Epic Details

### Epic 1: Plano de Ação — Core (Backend + CRUD + Métricas)

**Goal:** Entregar o fluxo completo de criação de planos de ação com dados automáticos das integrações existentes, CRUD de Gaps/Alavancas com estrutura de árvore, e edição manual de todos os campos. Ao final deste epic, o ADMIN consegue criar, editar e salvar planos completos.

---

#### Story 1.1: Schema, Sidebar e Página de Listagem

**Como** ADMIN da CDR Group,
**Quero** ver a nova aba "Plano de Ação" no sidebar e acessar a lista de planos,
**Para que** eu tenha um ponto de entrada claro para a feature.

**Acceptance Criteria:**

1. Modelo `ActionPlan` criado no Prisma schema com todos os campos definidos na seção 5.3, migration executada com sucesso sem impactar tabelas existentes
2. Enum `ActionPlanStatus` (DRAFT, FINALIZED) adicionado ao schema
3. Relação `ActionPlan → Organization` e `ActionPlan → User` configuradas corretamente
4. Nova aba "Plano de Ação" aparece no sidebar logo abaixo de "Dashboard", no grupo "CDR AI", com ícone Lucide adequado
5. Rota `/plano-de-acao` criada dentro do grupo `(dashboard)` com page.tsx funcional
6. Página lista todos os planos da organização do usuário logado, exibindo: título, período, status (badge Rascunho/Finalizado), data de criação
7. Botão "Novo Plano de Ação" visível apenas para OWNER/ADMIN
8. Estado vazio (empty state) exibido quando não há planos criados
9. Todas as rotas e funcionalidades existentes do app continuam funcionando normalmente
10. Build (`npm run build`) passa sem erros

---

#### Story 1.2: Criação de Plano com Métricas Automáticas

**Como** ADMIN,
**Quero** criar um novo plano e ter as métricas dos últimos 30 dias preenchidas automaticamente,
**Para que** eu não precise compilar dados manualmente de diferentes plataformas.

**Acceptance Criteria:**

1. Ao clicar "Novo Plano", abre formulário/modal pedindo: título e período de análise (default: últimos 30 dias)
2. Server action `createActionPlan` criada em `src/actions/action-plan.ts` que:
   - Calcula Faturamento Pago (soma de Orders pagas no período)
   - Calcula Valor Investido (soma de AdMetric.spend, platform FACEBOOK_ADS)
   - Calcula Valor Convertido (soma de AdMetric.revenue, platform FACEBOOK_ADS)
   - Calcula ROAS (convertido/investido)
   - Calcula CPA (investido/conversions)
   - Calcula Ticket Médio (faturamento/qtd pedidos)
3. Métricas exibidas em cards/grid no editor do plano com valores formatados (R$, %, x)
4. Top 5 Produtos mais vendidos extraídos de `Order.rawData` (line items), ordenados por quantidade
5. Top 3 Coleções extraídas de `Order.rawData` quando disponível, com fallback para input manual
6. Top 5 Criativos ranqueados por score composto (ROAS + Vendas + Gasto normalizados, pesos iguais 1/3 cada), exibindo thumbnail, gasto, vendas, ROAS e score
7. Dados carregam em menos de 5 segundos
8. Plano salvo no banco com status DRAFT
9. Redirecionamento para a página de edição do plano após criação

---

#### Story 1.3: CRUD de Gaps e Alavancas com Árvore

**Como** ADMIN,
**Quero** adicionar Gaps e Alavancas com estrutura de árvore (título → raízes → sub-itens),
**Para que** eu documente os gargalos e oportunidades de forma organizada como faço hoje no mind-map.

**Acceptance Criteria:**

1. Seção "Gaps" no editor do plano com botão "Adicionar Gap"
2. Cada Gap tem campo de título editável e uma árvore de raízes com pelo menos 3 níveis de profundidade
3. Interface de árvore permite: adicionar nó filho, editar texto do nó, remover nó, reordenar nós no mesmo nível
4. Seção "Alavancas" com a mesma estrutura e funcionalidade dos Gaps
5. Múltiplos Gaps e múltiplas Alavancas podem ser adicionados ao mesmo plano
6. Dados de Gaps e Alavancas persistidos como JSON no campo correspondente do ActionPlan
7. Árvore renderiza visualmente com indentação e linhas de conexão (similar a um tree view)
8. Alterações são salvas automaticamente ou com botão "Salvar" explícito
9. UI responsiva — funcional em telas >= 1024px (desktop-first para edição)

---

#### Story 1.4: Edição Manual e Status do Plano

**Como** ADMIN,
**Quero** poder editar manualmente qualquer métrica ou dado do plano e controlar o status (Rascunho/Finalizado),
**Para que** eu ajuste valores incorretos ou adicione contexto antes de apresentar ao cliente.

**Acceptance Criteria:**

1. Todas as métricas (Faturamento, Investido, Convertido, ROAS, CPA, Ticket Médio) são editáveis inline — clique no valor para editar
2. Top Produtos: editar nome, quantidade e faturamento de cada item; adicionar/remover itens; reordenar
3. Top Coleções: editar nome, quantidade e faturamento; adicionar/remover; reordenar
4. Top Criativos: editar valores de gasto, vendas e ROAS de cada criativo; adicionar/remover; reordenar
5. Botão "Finalizar Plano" muda status de DRAFT para FINALIZED — exibe confirmação antes
6. Botão "Voltar para Rascunho" permite reverter de FINALIZED para DRAFT
7. Plano FINALIZED ativa o link público; plano DRAFT desativa
8. Server action `updateActionPlan` valida permissões (somente OWNER/ADMIN)
9. Timestamp `updatedAt` atualizado em cada salvamento
10. Toast de confirmação ao salvar com sucesso

---

### Epic 2: Apresentação HTML & Compartilhamento

**Goal:** Transformar o plano de ação em uma apresentação visual profissional acessível via link público, garantindo que o cliente consiga visualizar tanto na call quanto depois, logado no app.

---

#### Story 2.1: Apresentação Visual do Plano

**Como** ADMIN,
**Quero** gerar uma apresentação HTML bonita e profissional do plano de ação,
**Para que** eu apresente ao cliente em call com visual premium da CDR Group.

**Acceptance Criteria:**

1. Botão "Visualizar Apresentação" no editor que abre a apresentação em nova aba
2. Rota `/plano/[token]` criada FORA do grupo `(dashboard)` — não exige autenticação
3. Página renderiza o plano completo com visual de landing page/one-pager:
   - Header com logo/marca CDR Group + título do plano + período analisado
   - Seção de métricas em grid de cards com destaque visual
   - Seção de Top Produtos em tabela ou cards ranked
   - Seção de Top Coleções em cards
   - Seção de Top Criativos com thumbnails e métricas
   - Seção de Gaps em visual de árvore/mind-map estilizado
   - Seção de Alavancas em visual de árvore/mind-map estilizado
4. Design responsivo: otimizado para tela cheia em desktop (apresentação) + mobile (acesso posterior)
5. Visual premium: espaçamento generoso, tipografia limpa, cores do app, transições suaves (Framer Motion)
6. Rota retorna 404 se o plano não existe ou está com status DRAFT
7. Carregamento da página < 3 segundos

---

#### Story 2.2: Link Público e Acesso do Cliente

**Como** ADMIN,
**Quero** copiar o link público do plano e compartilhar com o cliente,
**Para que** ele acesse o plano de ação depois da call sem precisar me pedir.

**Como** CLIENT logado,
**Quero** ver meus planos de ação finalizados na aba "Plano de Ação",
**Para que** eu consulte as recomendações quando precisar.

**Acceptance Criteria:**

1. Botão "Copiar Link" na listagem e no editor que copia a URL pública (`/plano/[token]`) para a clipboard
2. Toast "Link copiado!" exibido ao copiar
3. Link público acessível sem autenticação (qualquer pessoa com o link pode ver)
4. Link público retorna 404 para planos com status DRAFT (somente FINALIZED ficam acessíveis)
5. Cliente logado (role CLIENT) vê a aba "Plano de Ação" no sidebar
6. Cliente vê apenas planos FINALIZED da sua organização na listagem
7. Cliente NÃO vê botões de editar, excluir ou criar — somente "Visualizar"
8. Ao clicar "Visualizar", o cliente é direcionado para a mesma apresentação visual (rota `/plano/[token]`)
9. Testes de regressão confirmam que nenhuma rota ou funcionalidade existente foi afetada
10. Build e deploy funcionam sem erros

---

## 8. Checklist Results Report

*A ser executado após aprovação do PRD pelo Ivan.*

---

## 9. Next Steps

### Architect Prompt

> Crie a arquitetura técnica detalhada para a feature "Plano de Ação" do Aplicativo CDR Group, usando como base o PRD em `docs/prd-plano-de-acao.md`. O app usa Next.js 16 + React 19 + Tailwind 4 + Prisma 6 + PostgreSQL (Neon), deploy na Vercel. Foque em: schema Prisma final, estrutura de Server Actions, componentes React necessários, e a rota pública sem auth. Garanta que nenhuma funcionalidade existente seja impactada.

### Dev Prompt

> Implemente a feature "Plano de Ação" seguindo o PRD em `docs/prd-plano-de-acao.md` e a arquitetura definida. Comece pelo Epic 1, Story 1.1 (schema + sidebar + listagem). Execute story por story, fazendo commit atômico após cada story completada.
