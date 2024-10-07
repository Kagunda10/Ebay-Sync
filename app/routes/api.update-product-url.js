import { json } from "@remix-run/node";
import db from "../db.server"; // Adjust the import path as necessary
import { authenticate } from "../shopify.server";


// This loader will handle the OPTIONS request for CORS
export const loader = async ({ request }) => {
    const { cors } = await authenticate.admin(request);
    return cors(json({ message: "CORS preflight successful" }));
};

export const action = async ({ request }) => {
    // Authenticate the request and get the shop details
    const { cors } = await authenticate.admin(request);
    const { sku, newUrl, shop } = await request.json();

    const shopDetails = await db.shop.findFirst({
        where: {
            name: shop,
        },
    });

    if (!shopDetails) {
        return cors(json({ errorMessage: "Shop not found" }, { status: 404 }));
    }

    const shopId = shopDetails.id;
    console.log(shopId);

    // const requestBody = await request.json();
    // console.log("Received POST request with body:", requestBody);

    try {
        const existingProduct = await db.product.findUnique({
            where: { SKU_shopId: { SKU: sku, shopId: shopId } },
        });

        if (existingProduct) {
            // If product exists, update it
            await db.product.update({
                where: { SKU_shopId: { SKU: sku, shopId: shopId } },
                data: { URL: newUrl },
            });
            console.log("Shop is:" + shop);
            return cors(json({ successMessage: "Product URL updated successfully", }));
        } else {
            // If product does not exist, create a new one
            await db.product.create({
                data: { SKU: sku, URL: newUrl, shopId: shopId },
            });
            return cors(json({ successMessage: "Product created successfully" }));
        }
    } catch (error) {
        console.error("Failed to update or create product:", error);
        return cors(json({ errorMessage: "Failed to update or create product" }, { status: 500 }));
    }
};
