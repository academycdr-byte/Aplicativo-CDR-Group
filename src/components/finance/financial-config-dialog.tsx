"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { saveFinancialConfig } from "@/actions/finance";
import { useToast } from "@/components/ui/use-toast";

type FinancialConfig = {
    defaultTaxRate: number;
    fixedTransactionFee: number;
};

export function FinancialConfigDialog({ config }: { config: FinancialConfig }) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState(config);
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            await saveFinancialConfig({
                defaultTaxRate: Number(formData.defaultTaxRate),
                fixedTransactionFee: Number(formData.fixedTransactionFee),
            });
            toast({ title: "Configurações salvas com sucesso!" });
            setIsOpen(false);
        } catch (error) {
            toast({ title: "Erro ao salvar configurações", variant: "destructive" });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="w-4 h-4" />
                    Configurar Taxas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurações Financeiras</DialogTitle>
                    <DialogDescription>
                        Defina taxas globais aplicadas a todas as vendas para cálculo de lucro líquido.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="taxRate" className="text-right">Taxa Variável (%)</Label>
                        <div className="col-span-3">
                            <Input
                                id="taxRate"
                                type="number"
                                step="0.1"
                                value={formData.defaultTaxRate}
                                onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) })}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Ex: 5.0 para 5% (Gateway + Plataforma)</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fixedFee" className="text-right">Taxa Fixa (R$)</Label>
                        <div className="col-span-3">
                            <Input
                                id="fixedFee"
                                type="number"
                                step="0.01"
                                value={formData.fixedTransactionFee}
                                onChange={(e) => setFormData({ ...formData, fixedTransactionFee: parseFloat(e.target.value) })}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Custo fixo por transação (ex: R$ 0,50)</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Alterações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
