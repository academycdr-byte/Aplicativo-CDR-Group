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
import { toast } from "sonner";

type FinancialConfig = {
    defaultTaxRate: number;
    fixedTransactionFee: number;
    gatewayRate: number;
    checkoutRate: number;
    taxBase: string;
    fixedCosts: number;
    chargebackRate: number;
};

export function FinancialConfigDialog({ config }: { config: FinancialConfig }) {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState(config);

    const handleSave = async () => {
        try {
            await saveFinancialConfig({
                defaultTaxRate: Number(formData.defaultTaxRate),
                fixedTransactionFee: Number(formData.fixedTransactionFee),
                gatewayRate: Number(formData.gatewayRate),
                checkoutRate: Number(formData.checkoutRate),
                taxBase: formData.taxBase,
                fixedCosts: Number(formData.fixedCosts),
                chargebackRate: Number(formData.chargebackRate),
            });
            toast.success("Configurações salvas com sucesso!");
            setIsOpen(false);
        } catch {
            toast.error("Erro ao salvar configurações");
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
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Configurações Financeiras</DialogTitle>
                    <DialogDescription>
                        Defina taxas e custos aplicados ao cálculo de lucro líquido.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="gatewayRate">% de Gateway</Label>
                        <Input
                            id="gatewayRate"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formData.gatewayRate}
                            onChange={(e) => setFormData({ ...formData, gatewayRate: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Porcentagem sobre o faturamento cobrada pelo gateway de pagamento (ex: 3.99)</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="checkoutRate">% de Checkout</Label>
                        <Input
                            id="checkoutRate"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formData.checkoutRate}
                            onChange={(e) => setFormData({ ...formData, checkoutRate: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Porcentagem sobre o faturamento cobrada pela plataforma de checkout (ex: 1.99)</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="taxRate">% de Imposto</Label>
                        <Input
                            id="taxRate"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formData.defaultTaxRate}
                            onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="flex gap-3 mt-2">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="radio"
                                    name="taxBase"
                                    value="revenue"
                                    checked={formData.taxBase === "revenue"}
                                    onChange={() => setFormData({ ...formData, taxBase: "revenue" })}
                                    className="accent-primary"
                                />
                                Sobre Faturamento Total
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                    type="radio"
                                    name="taxBase"
                                    value="profit"
                                    checked={formData.taxBase === "profit"}
                                    onChange={() => setFormData({ ...formData, taxBase: "profit" })}
                                    className="accent-primary"
                                />
                                Sobre o Lucro
                            </label>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="fixedFee">Taxa Fixa por Transação (R$)</Label>
                        <Input
                            id="fixedFee"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.fixedTransactionFee}
                            onChange={(e) => setFormData({ ...formData, fixedTransactionFee: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Custo fixo por transação aprovada (ex: R$ 0,50)</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="fixedCosts">Custos Fixos Mensais (R$)</Label>
                        <Input
                            id="fixedCosts"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.fixedCosts}
                            onChange={(e) => setFormData({ ...formData, fixedCosts: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Valor fixo deduzido da receita (ferramentas, aluguel, etc.)</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="chargebackRate">% de Chargebacks/Estornos</Label>
                        <Input
                            id="chargebackRate"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formData.chargebackRate}
                            onChange={(e) => setFormData({ ...formData, chargebackRate: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Calcula: ticket médio × porcentagem informada</p>
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
