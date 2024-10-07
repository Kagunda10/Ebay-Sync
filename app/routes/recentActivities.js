// app/routes/api/recentActivities.js

import db from "~/db.server";

export async function getRecentActivities(shopName) {
    const shop = await db.shop.findUnique({
        where: { name: shopName },
        select: { id: true }
    });
    return await db.recentActivity.findMany({
        where: { shopId: shop.id },
        include: {
            shop: true // Including shop details
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

export async function logActivity({ type, description, shopId }) {
    try {
        await db.recentActivity.create({
            data: {
                type,
                description,
                shopId,
            },
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
        throw new Error("Failed to log activity.");
    }
}