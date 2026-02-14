"use client";

import { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getSelectedFacebookAccounts } from "@/actions/integrations";

type AdAccount = { id: string; name: string };

export function AdAccountFilter({
    value,
    onChange,
}: {
    value: string;
    onChange: (accountId: string) => void;
}) {
    const [accounts, setAccounts] = useState<AdAccount[]>([]);

    useEffect(() => {
        getSelectedFacebookAccounts().then(setAccounts);
    }, []);

    if (accounts.length <= 1) return null;

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar por conta de anuncios">
                <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.replace("act_", "")}>
                        {acc.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
