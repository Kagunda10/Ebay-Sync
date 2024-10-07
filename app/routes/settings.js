// app/routes/api/settings.js

import { json } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }) {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shopId");
    const settings = await db.setting.findFirst({
        where: { shopId: Number(shopId) }
    });
    return json({ settings });
}

export async function action({ request }) {
    console.log('Received request to save settings');
    const formData = Object.fromEntries(await request.formData());
    const { frequency, markup, concurrentScrapeSync, lowStockAlert, emails, shopId } = formData;


    // Parse emails from JSON string to array
    const emailArray = JSON.parse(emails);

    // Check if settings already exist for the given shopId
    const existingSettings = await db.setting.findFirst({
        where: { shopId: Number(shopId) }
    });

    let settings;
    if (existingSettings) {
        // Update existing settings
        settings = await db.setting.update({
            where: { id: existingSettings.id },
            data: {
                frequency,
                markup: Number(markup),
                concurrentScrapeSync: concurrentScrapeSync === "true",
                lowStockAlert: lowStockAlert === "true",
                emails: JSON.stringify(emailArray) // Store emails as JSON string
            },
        });
    } else {
        // Create new settings
        settings = await db.setting.create({
            data: {
                frequency,
                markup: Number(markup),
                concurrentScrapeSync: concurrentScrapeSync === "true",
                lowStockAlert: lowStockAlert === "true",
                emails: JSON.stringify(emailArray), // Store emails as JSON string
                shopId: Number(shopId)
            },
        });
    }

    console.log('Settings saved:', settings);

    return json({ settings });
}
