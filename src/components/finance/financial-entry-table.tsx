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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { saveFinancialEntry, deleteFinancialEntry } from "@/actions/finance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FinancialEntry = {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    category: string;
    entryDate: string | Date;
};

const CATEGORIES = [
    { value: "ferramentas", label: "Ferramentas", type: "cost" },
    { value: "marketing", label: "Marketing", type: "cost" },
    { value: "freelancer", label: "Freelancer/Servicos", type: "cost" },
    { value: "logistica", label: "Logistica", type: "cost" },
    { value: "escritorio", label: "Escritorio/Aluguel", type: "cost" },
    { value: "devolucao", label: "Devolucao/Reembolso", type: "cost" },
    { value: "bonus", label: "Bonus/Premio", type: "income" },
    { value: "revenda", label: "Revenda", type: "income" },
    { value: "servico", label: "Servico Prestado", type: "income" },
    { value: "outro", label: "Outro", type: "both" },
] as const;

function fmt(val: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("pt-BR");
}

function getCategoryLabel(value: string) {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function FinancialEntryTable({
    entries,
    onUpdate,
}: {
    entries: FinancialEntry[];
    onUpdate?: () => void;
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newEntry, setNewEntry] = useState({
        type: "cost" as "cost" | "income",
        amount: 0,
        description: "",
        category: "",
        entryDate: new Date().toISOString().split("T")[0],
    });
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<"all" | "cost" | "income">("all");

    const filteredEntries = filterType === "all"
        ? entries
        : entries.filter((e) => e.type === filterType);

    const totalCosts = entries.filter((e) => e.type === "cost").reduce((sum, e) => sum + Number(e.amount), 0);
    const totalIncome = entries.filter((e) => e.type === "income").reduce((sum, e) => sum + Number(e.amount), 0);

    const filteredCategories = CATEGORIES.filter(
        (c) => c.type === newEntry.type || c.type === "both"
    );

    const handleCreate = async () => {
        if (!newEntry.amount || newEntry.amount <= 0) {
            toast.error("Informe um valor maior que zero");
            return;
        }
        if (!newEntry.category) {
            toast.error("Selecione uma categoria");
            return;
        }

        try {
            await saveFinancialEntry({
                type: newEntry.type,
                amount: Number(newEntry.amount),
                description: newEntry.description || undefined,
                category: newEntry.category,
                entryDate: new Date(newEntry.entryDate + "T12:00:00"),
            });
            toast.success("Lancamento registrado com sucesso!");
            setIsDialogOpen(false);
            setNewEntry({
                type: "cost",
                amount: 0,
                description: "",
                category: "",
                entryDate: new Date().toISOString().split("T")[0],
            });
            onUpdate?.();
        } catch {
            toast.error("Erro ao registrar lancamento");
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await deleteFinancialEntry(id);
            toast.success("Lancamento removido");
            onUpdate?.();
        } catch {
            toast.error("Erro ao remover lancamento");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-medium">Lancamentos Manuais</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Lancamento
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Lancamento</DialogTitle>
                            <DialogDescription>
                                Registre um custo avulso ou uma receita extra.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {/* Type Selection */}
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label
                                        className={cn(
                                            "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                                            newEntry.type === "cost"
                                                ? "border-red-500 bg-red-500/5"
                                                : "border-border hover:border-red-500/40"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="entryType"
                                            value="cost"
                                            checked={newEntry.type === "cost"}
                                            onChange={() => setNewEntry({ ...newEntry, type: "cost", category: "" })}
                                            className="accent-red-500"
                                        />
                                        <ArrowDownLeft className="w-4 h-4 text-red-500 shrink-0" />
                                        <span className="text-sm font-medium">Custo</span>
                                    </label>
                                    <label
                                        className={cn(
                                            "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                                            newEntry.type === "income"
                                                ? "border-emerald-500 bg-emerald-500/5"
                                                : "border-border hover:border-emerald-500/40"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="entryType"
                                            value="income"
                                            checked={newEntry.type === "income"}
                                            onChange={() => setNewEntry({ ...newEntry, type: "income", category: "" })}
                                            className="accent-emerald-500"
                                        />
                                        <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="text-sm font-medium">Receita</span>
                                    </label>
                                </div>
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select
                                    value={newEntry.category}
                                    onValueChange={(val) => setNewEntry({ ...newEntry, category: val })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione a categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCategories.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Amount */}
                            <div className="space-y-2">
                                <Label htmlFor="entryAmount">Valor (R$)</Label>
                                <Input
                                    id="entryAmount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newEntry.amount || ""}
                                    onChange={(e) => setNewEntry({ ...newEntry, amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0,00"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="entryDesc">Descricao (opcional)</Label>
                                <Input
                                    id="entryDesc"
                                    value={newEntry.description}
                                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                    placeholder="Ex: Pagamento freelancer designer"
                                />
                            </div>

                            {/* Date */}
                            <div className="space-y-2">
                                <Label htmlFor="entryDate">Data</Label>
                                <Input
                                    id="entryDate"
                                    type="date"
                                    value={newEntry.entryDate}
                                    onChange={(e) => setNewEntry({ ...newEntry, entryDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate}>Registrar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant={filterType === "all" ? "default" : "outline"}
                    onClick={() => setFilterType("all")}
                    className="text-xs h-7"
                >
                    Todos ({entries.length})
                </Button>
                <Button
                    size="sm"
                    variant={filterType === "cost" ? "default" : "outline"}
                    onClick={() => setFilterType("cost")}
                    className="text-xs h-7"
                >
                    Custos ({entries.filter((e) => e.type === "cost").length})
                </Button>
                <Button
                    size="sm"
                    variant={filterType === "income" ? "default" : "outline"}
                    onClick={() => setFilterType("income")}
                    className="text-xs h-7"
                >
                    Receitas ({entries.filter((e) => e.type === "income").length})
                </Button>
            </div>

            {/* Table */}
            <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[540px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                            <TableHead className="hidden sm:table-cell">Descricao</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEntries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell className="font-medium">{formatDate(entry.entryDate)}</TableCell>
                                <TableCell>
                                    {entry.type === "income" ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] sm:text-xs">
                                            Receita
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] sm:text-xs">
                                            Custo
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">{getCategoryLabel(entry.category)}</TableCell>
                                <TableCell className="hidden sm:table-cell">{entry.description || "-"}</TableCell>
                                <TableCell className={cn(
                                    "text-right font-medium",
                                    entry.type === "income" ? "text-emerald-600" : "text-red-600"
                                )}>
                                    {entry.type === "income" ? "+" : "-"}{fmt(Number(entry.amount))}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        disabled={deletingId === entry.id}
                                        onClick={() => handleDelete(entry.id)}
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredEntries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Nenhum lancamento registrado no periodo. Clique em &quot;Novo Lancamento&quot; para adicionar.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Totals */}
            {entries.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-6">
                    <div className="text-sm font-medium">
                        Total Custos: <span className="text-base font-bold text-red-600">{fmt(totalCosts)}</span>
                    </div>
                    <div className="text-sm font-medium">
                        Total Receitas: <span className="text-base font-bold text-emerald-600">{fmt(totalIncome)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
