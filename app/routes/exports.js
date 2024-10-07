import db from '../db.server'; // Adjust this import according to your project structure
import { json } from '@remix-run/node';
import { logActivity } from "app/routes/recentActivities";

async function findOrCreateShopIdByName(shopName) {
    let shop;

    try {
        // Try to find the shop by its unique name
        shop = await db.shop.findUnique({
            where: {
                name: shopName,
            },
        });

        // If the shop doesn't exist, create it
        if (!shop) {
            shop = await db.shop.create({
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


export async function loader({ request }) {
    const url = new URL(request.url);
    const exportType = url.searchParams.get("exportType");
    const shopName = url.searchParams.get("shop")
    const shopId = await findOrCreateShopIdByName(shopName);

    try {
        let products;
        if (exportType === "all") {
            console.log(exportType);
            products = await db.product.findMany({
                where: {
                    shopId: shopId
                }
            }
            );
        } else if (exportType === "zeroQuantity") {
            products = await db.product.findMany({
                where: {
                    shopId: shopId,
                    OR: [{ quantity: null }, { quantity: 0 }]
                },
            });
        } else {
            return new Response("Invalid export type", { status: 400 });
        }

        if (products.length === 0) {
            console.log("No products found, sending message.");
            return new Response(JSON.stringify({ message: `No products found for the selected export type: ${exportType}.` }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }


        const csv = convertToCSV(products);
        await logActivity({
            type: "Export",
            description: `Exported ${products.length} products`,
            shopId
        });

        return new Response(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="export_${exportType}.csv"`
            }
        });



    } catch (error) {
        console.error("Error in loader:", error);
        return json({ message: "Server error occurred." }, { status: 500 });
    }
}
function convertToCSV(products) {
    if (products.length === 0) return "";

    // Extract headers from the first product keys
    const headers = Object.keys(products[0]).join(",");

    // Map over the products to create CSV rows
    const rows = products.map(product => {
        return Object.values(product).map(value => {
            // Check for null or undefined values before calling toString
            if (value === null || value === undefined) {
                return ""; // Return an empty string for null or undefined values
            }
            // Otherwise, convert the value to string and escape double quotes
            return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(",");
    });

    return [headers, ...rows].join("\n");
}

