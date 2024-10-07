// routes/upload.jsx
import { json } from "@remix-run/node";
import { parse } from "csv-parse/sync"; // Using csv-parse for CSV processing
import db from "../db.server"; // Adjust the import path as necessary
import { logActivity } from "app/routes/recentActivities";

// export const action = async ({ request }) => {
//     const url = new URL(request.url, `http://${request.headers.get('host')}`);
//     const shopName = url.searchParams.get('shop'); // Extract 'shop' from URL query parameters
//     const shopId = await findOrCreateShopIdByName(shopName);


//     const formData = await request.formData();
//     const file = formData.get("file");

//     if (!(file instanceof File)) {
//         throw new Error("Uploaded content is not a file");
//     }

//     const fileContent = await file.text();
//     const records = parse(fileContent, {
//         columns: true,
//         skip_empty_lines: true,
//     });

//     // Further processing...
//     const requiredHeaders = ["sku", "url"];
//     const headers = Object.keys(records[0]);
//     const isValidHeader = header => headers.some(h => h.toLowerCase().includes(header));

//     if (!requiredHeaders.every(isValidHeader)) {
//         return json({ message: "Invalid CSV header" }, 400);
//     }
//     for (const record of records) {
//         try {
//             const skuHeader = headers.find(h => h.toLowerCase().includes("sku"));
//             const urlHeader = headers.find(h => h.toLowerCase().includes("url"));
//             const sku = record[skuHeader];
//             const url = record[urlHeader];

//             // Here you can use the shopName to associate records with a specific shop
//             // For example, you might have a `findOrCreateShopIdByName` function that gets/creates a shop ID based on the shopName


//             // Check if product already exists
//             const existingProduct = await db.product.findUnique({
//                 where: {
//                     SKU_shopId: { SKU: sku, shopId },
//                 },
//             });

//             if (existingProduct) {
//                 // Handle existing product (e.g., skip or update)
//                 continue; // This skips the current record
//             }

//             await db.product.create({
//                 data: {
//                     SKU: sku,
//                     URL: url,
//                     shopId,
//                 },
//             });


//         } catch (error) {
//             console.error("Error processing record:", error);
//         }

//     }

//     await logActivity({
//         type: "Import",
//         description: `Imported ${records.length} products`,
//         shopId
//     });

//     return json({ message: "File uploaded and processed successfully" });
// };

export const action = async ({ request }) => {
    const url = new URL(request.url, `http://${request.headers.get('host')}`);
    const shopName = url.searchParams.get('shop'); // Extract 'shop' from URL query parameters
    const shopId = await findOrCreateShopIdByName(shopName);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
        throw new Error("Uploaded content is not a file");
    }

    const fileContent = await file.text();
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
    });

    const requiredHeaders = ["sku", "url"];
    const headers = Object.keys(records[0]);
    const isValidHeader = header => headers.some(h => h.toLowerCase().includes(header));

    if (!requiredHeaders.every(isValidHeader)) {
        return json({ message: "Invalid CSV header" }, 400);
    }

    // Optional: find the 'markup' header if it exists
    const markupHeader = headers.find(h => h.toLowerCase().includes("markup"));

    for (const record of records) {
        try {
            const skuHeader = headers.find(h => h.toLowerCase().includes("sku"));
            const urlHeader = headers.find(h => h.toLowerCase().includes("url"));
            const sku = record[skuHeader];
            const url = record[urlHeader];

            // Check if product already exists
            const existingProduct = await db.product.findUnique({
                where: {
                    SKU_shopId: { SKU: sku, shopId },
                },
            });



            // Get the markup from the record if the header exists
            const markup = markupHeader ? parseInt(record[markupHeader], 10) : null;

            try {
                if (existingProduct) {
                    // Update existing product
                    await db.product.update({
                        where: {
                            id: existingProduct.id
                        },
                        data: {
                            URL: url,
                            markup: markup !== null ? markup : undefined,
                        },
                    });
                } else {
                    // Create new product if it does not exist
                    await db.product.create({
                        data: {
                            SKU: sku,
                            URL: url,
                            shopId,
                            markup: markup !== null ? markup : undefined,
                        },
                    });
                }
            } catch (error) {
                if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
                    console.error('Encountered an ID conflict. Attempting to resolve...');

                    // Get the highest existing ID
                    const highestProduct = await db.product.findFirst({
                        orderBy: {
                            id: 'desc',
                        },
                    });

                    const nextId = (highestProduct?.id || 0) + 1;

                    // Attempt to create the product with the next available ID
                    await db.product.create({
                        data: {
                            id: nextId,
                            SKU: sku,
                            URL: url,
                            shopId,
                            markup: markup !== null ? markup : undefined,
                        },
                    });
                } else {
                    // If it's not an ID conflict, rethrow the error
                    throw error;
                }
            }


        } catch (error) {
            console.error("Error processing record:", error);
        }

    }

    await logActivity({
        type: "Import",
        description: `Imported ${records.length} products`,
        shopId
    });

    return json({ message: "File uploaded and processed successfully" });
};


// The rest of your findOrCreateShopIdByName function...

async function findOrCreateShopIdByName(shopName) {
    let shop;

    try {
        // Try to find the shop by its unique name
        shop = await prisma.shop.findUnique({
            where: {
                name: shopName,
            },
        });

        // If the shop doesn't exist, create it
        if (!shop) {
            shop = await prisma.shop.create({
                data: {
                    name: shopName,
                    // isActive is true by default, as defined in your schema
                    // createdAt and updatedAt are automatically set by Prisma
                },
            });
        }
    } catch (error) {
        console.error('Error in findOrCreateShopIdByName:', error);
        throw error; // Rethrow or handle as needed
    }

    // Return the ID of the found or created shop
    return shop.id;
}