import { json } from '@remix-run/node';
import Redis from 'ioredis';

const redis = new Redis();

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');
    if (!shop) {
        return json({ status: 'error', message: 'Shop parameter is missing' }, { status: 400 });
    }

    const status = await redis.get(`syncJobStatus:${shop}`);
    return json({ status: status || 'idle' });
};
