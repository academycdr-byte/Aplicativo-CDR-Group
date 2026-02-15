"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { saveSupplierPayment, deleteSupplierPayment } from "@/actions/finance";
import { toast } from "sonner";

type SupplierPayment = {
    id: string;
    amount: number;
    description: string | null;
    paymentDate: string | Date;
};

function fmt(val: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("pt-BR");
}

export function SupplierPaymentTable({
    payments,
    onUpdate,
}: {
    payments: SupplierPayment[];
    onUpdate?: () => void;
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({
        amount: 0,
        description: "",
        paymentDate: new Date().toISOString().split("T")[0],
    });
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const handleCreate = async () => {
        if (!newPayment.amount || newPayment.amount <= 0) {
            toast.error("Informe um valor maior que zero");
            return;
        }

        try {
            await saveSupplierPayment({
                amount: Number(newPayment.amount),
                description: newPayment.description || undefined,
                paymentDate: new Date(newPayment.paymentDate + "T12:00:00"),
            });
            toast.success("Pagamento registrado com sucesso!");
            setIsDialogOpen(false);
            setNewPayment({ amount: 0, description: "", paymentDate: new Date().toISOString().split("T")[0] });
            onUpdate?.();
        } catch {
            toast.error("Erro ao registrar pagamento");
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await deleteSupplierPayment(id);
            toast.success("Pagamento removido");
            onUpdate?.();
        } catch {
            toast.error("Erro ao remover pagamento");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Pagamentos ao Fornecedor</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Registrar Pagamento
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registrar Pagamento ao Fornecedor</DialogTitle>
                            <DialogDescription>
                                Registre um pagamento feito ao fornecedor para cálculo do CMV.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="paymentAmount">Valor (R$)</Label>
                                <Input
                                    id="paymentAmount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newPayment.amount || ""}
                                    onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentDesc">Descrição</Label>
                                <Input
                                    id="paymentDesc"
                                    value={newPayment.description}
                                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                                    placeholder="Ex: Lote de camisetas janeiro"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentDate">Data</Label>
                                <Input
                                    id="paymentDate"
                                    type="date"
                                    value={newPayment.paymentDate}
                                    onChange={(e) => setNewPayment({ ...newPayment, paymentDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate}>Registrar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[420px]" aria-label="Pagamentos ao fornecedor">
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">Data</TableHead>
                            <TableHead scope="col">Descrição</TableHead>
                            <TableHead scope="col" className="text-right">Valor</TableHead>
                            <TableHead scope="col" className="w-[60px]"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-medium">{formatDate(payment.paymentDate)}</TableCell>
                                <TableCell>{payment.description || "-"}</TableCell>
                                <TableCell className="text-right">{fmt(Number(payment.amount))}</TableCell>
                                <TableCell>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        disabled={deletingId === payment.id}
                                        onClick={() => handleDelete(payment.id)}
                                        aria-label={`Excluir pagamento de ${fmt(Number(payment.amount))}`}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {payments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    Nenhum pagamento registrado no período. Clique em &quot;Registrar Pagamento&quot; para adicionar.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {payments.length > 0 && (
                <div className="flex justify-end">
                    <div className="text-sm font-medium">
                        Total no período: <span className="text-base font-bold">{fmt(total)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
