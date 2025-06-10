import mongoose from 'mongoose';
import Product from '../models/Product';

export interface StockValidationItem {
  productId: string;
  variantId?: string;
  name: string;
  requestedQuantity: number;
  price: number;
  selectedAttributes?: Record<string, string>;
}

export interface StockValidationResult {
  isValid: boolean;
  validationResult: 'all_available' | 'partial_available' | 'none_available';
  availableItems: Array<{
    productId: string;
    variantId?: string;
    variantSku?: string;
    name: string;
    availableQuantity: number;
    requestedQuantity: number;
    actualQuantity: number; // quantity we can fulfill
  }>;
  partiallyAvailableItems: Array<{
    productId: string;
    variantId?: string;
    variantSku?: string;
    name: string;
    availableQuantity: number;
    requestedQuantity: number;
    shortfall: number; // how much we're short
  }>;
  unavailableItems: Array<{
    productId: string;
    variantId?: string;
    variantSku?: string;
    name: string;
    availableQuantity: number;
    requestedQuantity: number;
    shortfall: number; // how much we're short
  }>;
  errorMessage?: string;
}

export async function validateOrderStock(items: StockValidationItem[]): Promise<StockValidationResult> {
  const availableItems: StockValidationResult['availableItems'] = [];
  const partiallyAvailableItems: StockValidationResult['partiallyAvailableItems'] = [];
  const unavailableItems: StockValidationResult['unavailableItems'] = [];

  try {
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        unavailableItems.push({
          productId: item.productId,
          variantId: item.variantId,
          variantSku: undefined,
          name: item.name,
          availableQuantity: 0,
          requestedQuantity: item.requestedQuantity,
          shortfall: item.requestedQuantity
        });
        continue;
      }

      const product = await Product.findById(item.productId);
      
      if (!product) {
        unavailableItems.push({
          productId: item.productId,
          variantId: item.variantId,
          variantSku: undefined,
          name: item.name,
          availableQuantity: 0,
          requestedQuantity: item.requestedQuantity,
          shortfall: item.requestedQuantity
        });
        continue;
      }

      let availableQuantity = 0;
      let variantSku: string | undefined;

      // Check variant or simple product stock
      if (product.hasVariants && item.variantId) {
        const variant = product.variants.find((v: any) => v._id.toString() === item.variantId);
        if (variant && variant.isActive) {
          availableQuantity = variant.stockQuantity || 0;
          variantSku = variant.sku;
        }
      } else if (product.hasVariants && item.selectedAttributes) {
        // Find variant by attribute combination
        const variant = product.variants.find((v: any) => {
          if (!v.isActive) return false;
          const variantAttrs = Object.fromEntries(v.attributeCombination);
          return Object.keys(item.selectedAttributes!).every(key => 
            variantAttrs[key] === item.selectedAttributes![key]
          );
        });
        if (variant) {
          availableQuantity = variant.stockQuantity || 0;
          variantSku = variant.sku;
        }
      } else if (!product.hasVariants) {
        // Simple product
        availableQuantity = product.stockQuantity || 0;
      }

      // Determine if item is available, partially available, or unavailable
      if (availableQuantity >= item.requestedQuantity) {
        // Fully available
        availableItems.push({
          productId: item.productId,
          variantId: item.variantId,
          variantSku,
          name: item.name,
          availableQuantity,
          requestedQuantity: item.requestedQuantity,
          actualQuantity: item.requestedQuantity
        });
      } else if (availableQuantity > 0) {
        // Partially available
        partiallyAvailableItems.push({
          productId: item.productId,
          variantId: item.variantId,
          variantSku,
          name: item.name,
          availableQuantity,
          requestedQuantity: item.requestedQuantity,
          shortfall: item.requestedQuantity - availableQuantity
        });
      } else {
        // Completely unavailable
        unavailableItems.push({
          productId: item.productId,
          variantId: item.variantId,
          variantSku,
          name: item.name,
          availableQuantity,
          requestedQuantity: item.requestedQuantity,
          shortfall: item.requestedQuantity
        });
      }
    }

    // Determine overall validation result
    let validationResult: StockValidationResult['validationResult'];
    let isValid = false;

    if (unavailableItems.length === 0 && partiallyAvailableItems.length === 0) {
      validationResult = 'all_available';
      isValid = true;
    } else if (availableItems.length > 0 || partiallyAvailableItems.length > 0) {
      validationResult = 'partial_available';
      isValid = false;
    } else {
      validationResult = 'none_available';
      isValid = false;
    }

    return {
      isValid,
      validationResult,
      availableItems,
      partiallyAvailableItems,
      unavailableItems
    };

  } catch (error) {
    console.error('Stock validation error:', error);
    return {
      isValid: false,
      validationResult: 'none_available',
      availableItems: [],
      partiallyAvailableItems: [],
      unavailableItems: items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        availableQuantity: 0,
        requestedQuantity: item.requestedQuantity,
        shortfall: item.requestedQuantity
      })),
      errorMessage: (error as Error).message
    };
  }
}

export async function deductStock(items: StockValidationItem[]): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        errors.push(`Product not found: ${item.productId}`);
        continue;
      }

      if (product.hasVariants && item.variantId) {
        // Deduct from specific variant
        const variantIndex = product.variants.findIndex((v: any) => v._id.toString() === item.variantId);
        if (variantIndex !== -1) {
          const variant = product.variants[variantIndex];
          if (variant.stockQuantity >= item.requestedQuantity) {
            product.variants[variantIndex].stockQuantity -= item.requestedQuantity;
            
            // Recalculate total stock
            product.stockQuantity = product.variants
              .filter((v: any) => v.isActive)
              .reduce((total: number, v: any) => total + v.stockQuantity, 0);
          } else {
            errors.push(`Insufficient stock for variant ${item.variantId} of product ${item.name}`);
            continue;
          }
        } else {
          errors.push(`Variant not found: ${item.variantId} for product ${item.productId}`);
          continue;
        }
      } else if (product.hasVariants && item.selectedAttributes) {
        // Find and deduct from variant by attributes
        const variantIndex = product.variants.findIndex((v: any) => {
          if (!v.isActive) return false;
          const variantAttrs = Object.fromEntries(v.attributeCombination);
          return Object.keys(item.selectedAttributes!).every(key => 
            variantAttrs[key] === item.selectedAttributes![key]
          );
        });
        
        if (variantIndex !== -1) {
          const variant = product.variants[variantIndex];
          if (variant.stockQuantity >= item.requestedQuantity) {
            product.variants[variantIndex].stockQuantity -= item.requestedQuantity;
            
            // Recalculate total stock
            product.stockQuantity = product.variants
              .filter((v: any) => v.isActive)
              .reduce((total: number, v: any) => total + v.stockQuantity, 0);
          } else {
            errors.push(`Insufficient stock for variant of product ${item.name}`);
            continue;
          }
        } else {
          errors.push(`Variant not found for attributes in product ${item.name}`);
          continue;
        }
      } else if (!product.hasVariants) {
        // Deduct from simple product
        if (product.stockQuantity >= item.requestedQuantity) {
          product.stockQuantity -= item.requestedQuantity;
        } else {
          errors.push(`Insufficient stock for product ${item.name}`);
          continue;
        }
      }

      await product.save();
    }

    return { success: errors.length === 0, errors };

  } catch (error) {
    console.error('Stock deduction error:', error);
    return { 
      success: false, 
      errors: [`Stock deduction failed: ${(error as Error).message}`] 
    };
  }
}

export async function restoreStock(items: StockValidationItem[]): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        errors.push(`Product not found: ${item.productId}`);
        continue;
      }

      if (product.hasVariants && item.variantId) {
        // Restore to specific variant
        const variantIndex = product.variants.findIndex((v: any) => v._id.toString() === item.variantId);
        if (variantIndex !== -1) {
          product.variants[variantIndex].stockQuantity += item.requestedQuantity;
          
          // Recalculate total stock
          product.stockQuantity = product.variants
            .filter((v: any) => v.isActive)
            .reduce((total: number, v: any) => total + v.stockQuantity, 0);
        } else {
          errors.push(`Variant not found: ${item.variantId} for product ${item.productId}`);
          continue;
        }
      } else if (product.hasVariants && item.selectedAttributes) {
        // Find and restore to variant by attributes
        const variantIndex = product.variants.findIndex((v: any) => {
          if (!v.isActive) return false;
          const variantAttrs = Object.fromEntries(v.attributeCombination);
          return Object.keys(item.selectedAttributes!).every(key => 
            variantAttrs[key] === item.selectedAttributes![key]
          );
        });
        
        if (variantIndex !== -1) {
          product.variants[variantIndex].stockQuantity += item.requestedQuantity;
          
          // Recalculate total stock
          product.stockQuantity = product.variants
            .filter((v: any) => v.isActive)
            .reduce((total: number, v: any) => total + v.stockQuantity, 0);
        } else {
          errors.push(`Variant not found for attributes in product ${item.name}`);
          continue;
        }
      } else if (!product.hasVariants) {
        // Restore to simple product
        product.stockQuantity += item.requestedQuantity;
      }

      await product.save();
    }

    return { success: errors.length === 0, errors };

  } catch (error) {
    console.error('Stock restoration error:', error);
    return { 
      success: false, 
      errors: [`Stock restoration failed: ${(error as Error).message}`] 
    };
  }
}

export function generateStockValidationMessage(result: StockValidationResult): string {
  if (result.validationResult === 'all_available') {
    return 'All items are available in stock.';
  } else if (result.validationResult === 'partial_available') {
    const unavailableCount = result.unavailableItems.length;
    const availableCount = result.availableItems.length;
    const partiallyAvailableCount = result.partiallyAvailableItems.length;
    
    let message = '';
    if (availableCount > 0) {
      message += `${availableCount} item(s) fully available`;
    }
    if (partiallyAvailableCount > 0) {
      if (message) message += ', ';
      message += `${partiallyAvailableCount} item(s) partially available`;
    }
    if (unavailableCount > 0) {
      if (message) message += ', ';
      message += `${unavailableCount} item(s) out of stock`;
    }
    
    return `${message}. Please review and edit the order.`;
  } else {
    return 'No items are available in stock. All requested items are out of stock.';
  }
}
