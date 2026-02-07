
export interface Product {
    id: string;
    title: string;
    price: number;
    currency: string;
    imageUrl: string;
    collection: string;
    vendor: string;
    totalSold?: number; // Optional: specific to "best sellers" context
}

export interface Collection {
    id: string;
    title: string;
}

export interface EcommerceService {
    getBestSellers(collectionId?: string): Promise<Product[]>;
    getCollections(): Promise<Collection[]>;
}

export class MockEcommerceService implements EcommerceService {
    private products: Product[] = [
        {
            id: "1",
            title: "Camiseta Basic Algodão Premium",
            price: 89.90,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop&q=60",
            collection: "verao-2025",
            vendor: "Loja Principal",
            totalSold: 1542
        },
        {
            id: "2",
            title: "Calça Jeans Slim Fit",
            price: 199.90,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=500&auto=format&fit=crop&q=60",
            collection: "inverno-2024",
            vendor: "Loja Principal",
            totalSold: 890
        },
        {
            id: "3",
            title: "Tênis Urban Runner",
            price: 299.90,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60",
            collection: "calcados",
            vendor: "Loja Esportes",
            totalSold: 2100
        },
        {
            id: "4",
            title: "Relógio Smart Watch Pro",
            price: 450.00,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
            collection: "acessorios",
            vendor: "Tech Store",
            totalSold: 560
        },
        {
            id: "5",
            title: "Óculos de Sol Aviador",
            price: 129.90,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&auto=format&fit=crop&q=60",
            collection: "acessorios",
            vendor: "Loja Principal",
            totalSold: 320
        },
        {
            id: "6",
            title: "Mochila Couro Sintético",
            price: 249.90,
            currency: "BRL",
            imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60",
            collection: "acessorios",
            vendor: "Loja Principal",
            totalSold: 410
        }
    ];

    private collections: Collection[] = [
        { id: "verao-2025", title: "Verão 2025" },
        { id: "inverno-2024", title: "Inverno 2024" },
        { id: "calcados", title: "Calçados" },
        { id: "acessorios", title: "Acessórios" }
    ];

    async getBestSellers(collectionId?: string): Promise<Product[]> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        let filtered = this.products;
        if (collectionId && collectionId !== "all") {
            filtered = this.products.filter(p => p.collection === collectionId);
        }

        // Sort by totalSold descending
        return filtered.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
    }

    async getCollections(): Promise<Collection[]> {
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.collections;
    }
}

export const ecommerceService = new MockEcommerceService();
