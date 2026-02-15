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
import { Settings2, Package, Calculator, Truck } from "lucide-react";
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
    cmvMethod: string;
    averageCostPerOrder: number;
};

export function FinancialConfigDialog({ config, onSave }: { config: FinancialConfig; onSave?: () => void }) {
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
                cmvMethod: formData.cmvMethod,
                averageCostPerOrder: Number(formData.averageCostPerOrder),
            });
            toast.success("Configurações salvas com sucesso!");
            setIsOpen(false);
            onSave?.();
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
                        Defina taxas, custos e método de cálculo de CMV.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {/* CMV Method Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Método de Cálculo do CMV</Label>
                        <div className="grid grid-cols-1 gap-2">
                            <label
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    formData.cmvMethod === "sku"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="cmvMethod"
                                    value="sku"
                                    checked={formData.cmvMethod === "sku"}
                                    onChange={() => setFormData({ ...formData, cmvMethod: "sku" })}
                                    className="accent-primary"
                                />
                                <Package className="w-4 h-4 text-amber-500 shrink-0" />
                                <div>
                                    <span className="text-xs font-medium">Por SKU (produto a produto)</span>
                                    <p className="text-[10px] text-muted-foreground">Configure custos na tabela de produtos abaixo</p>
                                </div>
                            </label>
                            <label
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    formData.cmvMethod === "average"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="cmvMethod"
                                    value="average"
                                    checked={formData.cmvMethod === "average"}
                                    onChange={() => setFormData({ ...formData, cmvMethod: "average" })}
                                    className="accent-primary"
                                />
                                <Calculator className="w-4 h-4 text-blue-500 shrink-0" />
                                <div>
                                    <span className="text-xs font-medium">Custo Médio por Pedido</span>
                                    <p className="text-[10px] text-muted-foreground">Valor médio multiplicado pela quantidade de pedidos</p>
                                </div>
                            </label>
                            <label
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    formData.cmvMethod === "supplier_payments"
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="cmvMethod"
                                    value="supplier_payments"
                                    checked={formData.cmvMethod === "supplier_payments"}
                                    onChange={() => setFormData({ ...formData, cmvMethod: "supplier_payments" })}
                                    className="accent-primary"
                                />
                                <Truck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <div>
                                    <span className="text-xs font-medium">Pagamentos ao Fornecedor</span>
                                    <p className="text-[10px] text-muted-foreground">Registre pagamentos feitos ao fornecedor na secao abaixo</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Average Cost Per Order - only visible when method is "average" */}
                    {formData.cmvMethod === "average" && (
                        <div className="space-y-1.5 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                            <Label htmlFor="averageCostPerOrder">Custo Médio por Pedido (R$)</Label>
                            <Input
                                id="averageCostPerOrder"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.averageCostPerOrder}
                                onChange={(e) => setFormData({ ...formData, averageCostPerOrder: parseFloat(e.target.value) || 0 })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Este valor será multiplicado pela quantidade de pedidos no período. Ex: R$ 45,00 x 200 pedidos = CMV de R$ 9.000
                            </p>
                        </div>
                    )}

                    <div className="border-t pt-4 mt-1">
                        <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-3">Taxas e Custos</p>
                    </div>

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
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2">
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
                        <Label htmlFor="fixedFee">Taxa Fixa por Transacao (R$)</Label>
                        <Input
                            id="fixedFee"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.fixedTransactionFee}
                            onChange={(e) => setFormData({ ...formData, fixedTransactionFee: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-[10px] text-muted-foreground">Custo fixo por transacao aprovada (ex: R$ 0,50)</p>
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
                        <p className="text-[10px] text-muted-foreground">Calcula: ticket médio x porcentagem informada</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Alteracoes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
