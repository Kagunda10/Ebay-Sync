// operations.js

import db from '../db.server'; // Adjust this path as necessary

if (!db) {
  console.error('PrismaClient is not initialized');
  throw new Error('PrismaClient is not initialized');
}

// Function to search for a product by SKU
export const getProductBySKU = async (searchTerm) => {
    return await db.product.findUnique({
        where: {
            SKU: searchTerm,
        },
    });
};

// Function to update a product's URL by SKU
export const updateProductUrl = async (sku, newUrl) => {
    return await db.product.update({
        where: {
            SKU: sku,
        },
        data: {
            URL: newUrl,
        },
    });
};
