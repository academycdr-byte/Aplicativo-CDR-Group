"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
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

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
  shipped: { label: "Enviado", variant: "default" },
  delivered: { label: "Entregue", variant: "default" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState("all");
  const limit = 25;

  useEffect(() => {
    loadOrders();
  }, [page, platformFilter]);

  async function loadOrders() {
    const data = await getOrders({
      platform: platformFilter === "all" ? undefined : platformFilter,
      page,
      limit,
    });
    setOrders(data.orders);
    setTotal(data.total);
  }

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
    }).format(new Date(date));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Pedidos</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {total} pedido{total !== 1 ? "s" : ""} de todas as plataformas conectadas.
          </p>
        </div>

        <Select value={platformFilter} onValueChange={(val) => { setPlatformFilter(val); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas plataformas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas plataformas</SelectItem>
            <SelectItem value="SHOPIFY">Shopify</SelectItem>
            <SelectItem value="CARTPANDA">Cartpanda</SelectItem>
            <SelectItem value="YAMPI">Yampi</SelectItem>
            <SelectItem value="NUVEMSHOP">Nuvemshop</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {orders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              Nenhum pedido encontrado. Conecte suas plataformas para sincronizar pedidos.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const statusInfo = statusLabels[order.status] || { label: order.status, variant: "outline" as const };
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        #{order.externalOrderId}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customerName || "-"}</div>
                          <div className="text-xs text-muted-foreground">{order.customerEmail || ""}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {platformLabels[order.platform] || order.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Pagina {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
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
