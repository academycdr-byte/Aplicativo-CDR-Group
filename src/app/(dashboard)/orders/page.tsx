"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ShoppingBag, Search, X } from "lucide-react";
import { getOrders } from "@/actions/orders";

type Order = {
  id: string;
  externalOrderId: string;
  platform: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  totalAmount: number;
  currency: string;
  itemCount: number;
  orderDate: Date;
};

const platformLabels: Record<string, string> = {
  SHOPIFY: "Shopify",
  CARTPANDA: "Cartpanda",
  YAMPI: "Yampi",
  NUVEMSHOP: "Nuvemshop",
};

// Map status to valid Badge variants (default, secondary, destructive, outline) 
// and add custom classes for colors not covered by variants (like success/emerald)
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  paid: { label: "Pago", variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 border-transparent" },
  pending: { label: "Pendente", variant: "secondary", className: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline", className: "text-muted-foreground" },
  shipped: { label: "Enviado", variant: "secondary", className: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
  delivered: { label: "Entregue", variant: "default", className: "bg-emerald-500 hover:bg-emerald-600 border-transparent" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 25;

  useEffect(() => {
    loadOrders();
  }, [page, platformFilter, statusFilter, search, dateFrom, dateTo]);

  async function loadOrders() {
    const data = await getOrders({
      platform: platformFilter === "all" ? undefined : platformFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit,
    });
    setOrders(data.orders);
    setTotal(data.total);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function clearFilters() {
    setPlatformFilter("all");
    setStatusFilter("all");
    setSearch("");
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasFilters = platformFilter !== "all" || statusFilter !== "all" || search || dateFrom || dateTo;
  const totalPages = Math.ceil(total / limit);

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(amount);
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pedidos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie e acompanhe todos os pedidos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-7 px-3 text-xs font-normal">Total: {total}</Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="border border-border shadow-none rounded-lg">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-auto flex-1">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por cliente, email ou ID..."
                  className="pl-9 w-full"
                />
              </div>
              <Button type="submit" variant="secondary" className="shrink-0">
                Buscar
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Select value={platformFilter} onValueChange={(val) => { setPlatformFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="SHOPIFY">Shopify</SelectItem>
                  <SelectItem value="CARTPANDA">Cartpanda</SelectItem>
                  <SelectItem value="YAMPI">Yampi</SelectItem>
                  <SelectItem value="NUVEMSHOP">Nuvemshop</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 border rounded-md px-2 bg-background">
                <span className="text-xs text-muted-foreground whitespace-nowrap">De:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="bg-transparent h-9 text-sm outline-none w-[110px]"
                />
              </div>
              <div className="flex items-center gap-2 border rounded-md px-2 bg-background">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Até:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="bg-transparent h-9 text-sm outline-none w-[110px]"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar Filtros">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-2">
              {hasFilters
                ? "Tente ajustar os filtros ou a busca para encontrar o que procura."
                : "Seus pedidos sincronizados aparecerão aqui."}
            </p>
            {hasFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50 bg-muted/40">
                    <TableHead className="w-[140px]">Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const statusInfo = statusConfig[order.status] || { label: order.status, variant: "outline" };

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30 border-b border-border/50">
                        <TableCell className="font-medium text-xs">
                          <span className="font-mono text-muted-foreground">#</span>{order.externalOrderId}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{order.customerName || "N/A"}</span>
                            <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {platformLabels[order.platform] || order.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(order.orderDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className={`text-[10px] font-normal uppercase ${statusInfo.className || ""}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-right relative">
                          <span className="text-xs text-muted-foreground absolute top-1/2 -translate-y-1/2 right-full mr-1">R$</span>
                          {formatCurrency(order.totalAmount, order.currency).replace("R$", "").trim()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
