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
import { Plus, Pencil, Save, X } from "lucide-react";
import { saveProductCost } from "@/actions/finance";
import { toast } from "sonner";

type ProductCost = {
    id: string;
    sku: string;
    name: string | null;
    costPrice: number; // Decimal string from DB, converted to number
    imageUrl: string | null;
};

export function ProductCostTable({ costs }: { costs: ProductCost[] }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ProductCost>>({});
    const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ sku: "", name: "", costPrice: 0 });


    const handleEdit = (cost: ProductCost) => {
        setEditingId(cost.id);
        setEditForm({ ...cost });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async () => {
        if (!editForm.sku || editForm.costPrice === undefined) return;

        try {
            await saveProductCost({
                sku: editForm.sku,
                name: editForm.name || undefined,
                costPrice: Number(editForm.costPrice),
                imageUrl: editForm.imageUrl || undefined,
            });
            toast.success("Custo atualizado com sucesso!");
            setEditingId(null);
        } catch (error) {
            toast.error("Erro ao atualizar custo");
        }
    };

    const handleCreate = async () => {
        if (!newProduct.sku || newProduct.costPrice === undefined) return;

        try {
            await saveProductCost({
                sku: newProduct.sku,
                name: newProduct.name,
                costPrice: Number(newProduct.costPrice),
            });
            toast.success("Produto adicionado com sucesso!");
            setIsNewDialogOpen(false);
            setNewProduct({ sku: "", name: "", costPrice: 0 });
        } catch (error) {
            toast.error("Erro ao criar produto");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Custos de Produtos</h3>
                <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Produto
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Produto</DialogTitle>
                            <DialogDescription>
                                Cadastre o custo de um produto pelo SKU para cálculo de margem.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input
                                    id="sku"
                                    value={newProduct.sku}
                                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                                    placeholder="Ex: CAMISA-001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome</Label>
                                <Input
                                    id="name"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    placeholder="Ex: Camisa Básica Branca"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cost">Custo (R$)</Label>
                                <Input
                                    id="cost"
                                    type="number"
                                    step="0.01"
                                    value={newProduct.costPrice}
                                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate}>Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-2 sm:hidden">
                {costs.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                        Nenhum custo cadastrado. Adicione produtos para calcular o lucro real.
                    </div>
                ) : (
                    costs.map((cost) => (
                        <div key={cost.id} className="p-3 rounded-lg border border-border/50 bg-card/30 space-y-2">
                            {editingId === cost.id ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground">{cost.sku}</span>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
                                                <Save className="w-3.5 h-3.5 text-emerald-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
                                                <X className="w-3.5 h-3.5 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Input
                                        value={editForm.name || ""}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="h-8 text-sm"
                                        placeholder="Nome do produto"
                                    />
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={editForm.costPrice}
                                        onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) })}
                                        className="h-8 text-sm"
                                        placeholder="Custo R$"
                                    />
                                </>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{cost.name || cost.sku}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] text-muted-foreground">{cost.sku}</span>
                                            <span className="text-sm font-bold text-amber-600">R$ {Number(cost.costPrice).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleEdit(cost)}>
                                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="border rounded-md overflow-x-auto hidden sm:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nome do Produto</TableHead>
                            <TableHead className="text-right">Custo Unitário (R$)</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {costs.map((cost) => (
                            <TableRow key={cost.id}>
                                <TableCell className="font-medium">{cost.sku}</TableCell>
                                <TableCell>
                                    {editingId === cost.id ? (
                                        <Input
                                            value={editForm.name || ""}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="h-8"
                                        />
                                    ) : (
                                        cost.name || "-"
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {editingId === cost.id ? (
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={editForm.costPrice}
                                            onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) })}
                                            className="h-8 w-24 ml-auto"
                                        />
                                    ) : (
                                        `R$ ${Number(cost.costPrice).toFixed(2)}`
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingId === cost.id ? (
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
                                                <Save className="w-4 h-4 text-emerald-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
                                                <X className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(cost)}>
                                            <Pencil className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {costs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    Nenhum custo cadastrado. Adicione produtos para calcular o lucro real.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
