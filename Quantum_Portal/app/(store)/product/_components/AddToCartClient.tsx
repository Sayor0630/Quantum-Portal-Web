'use client';

import { useState } from 'react';
import { Paper, Text, NumberInput, Button } from '@mantine/core';
import { IconShoppingCartPlus } from '@tabler/icons-react';
import VariantSelector from './VariantSelector';

// Product Variant Interface
interface ProductVariant {
    _id?: string;
    attributeCombination: { [key: string]: string };
    sku?: string;
    price?: number;
    stockQuantity: number;
    isActive: boolean;
}

interface Product {
    _id: string;
    name: string;
    price: number;
    sku?: string;
    stockQuantity?: number;
    hasVariants?: boolean;
    attributeDefinitions?: { [key: string]: string[] };
    variants?: ProductVariant[];
}

interface AddToCartClientProps {
    product: Product;
}

export default function AddToCartClient({ product }: AddToCartClientProps) {
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

    if (product.hasVariants && product.attributeDefinitions && product.variants) {
        return (
            <VariantSelector
                attributeDefinitions={product.attributeDefinitions}
                variants={product.variants}
                basePrice={product.price}
                onVariantChange={setSelectedVariant}
            />
        );
    }

    // Non-variant product
    return (
        <Paper p="md" mt="lg" withBorder radius="sm" shadow="sm">
            <Text size="sm" mb="xs">Quantity:</Text>
            <NumberInput 
                defaultValue={1} 
                min={1} 
                max={product.stockQuantity && product.stockQuantity > 0 ? product.stockQuantity : 1} 
                mb="md" 
            />
            <Button 
                leftSection={<IconShoppingCartPlus size={18} />} 
                size="lg" 
                fullWidth 
                disabled={(product.stockQuantity || 0) === 0}
            >
                {(product.stockQuantity || 0) > 0 ? 'Add to Cart' : 'Out of Stock'} (UI Only)
            </Button>
        </Paper>
    );
}
