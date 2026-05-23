import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const BASE_URL = process.env.SCRAPER_BASE_URL ?? 'https://quizpractice.space';
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.SCRAPER_REQUEST_TIMEOUT_MS ?? '30000', 10);

export const jar = new CookieJar();
export const client = wrapper(axios.create({
    // @ts-ignore
    jar,
    withCredentials: true,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
    }
}));

client.interceptors.request.use((config) => {
    const requestUrl = new URL(config.url ?? BASE_URL, config.baseURL ?? BASE_URL).toString();
    const cookie = jar.getCookieStringSync(requestUrl);
    if (cookie) {
        config.headers.set('Cookie', cookie);
    }
    config.signal ??= AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return config;
});

client.interceptors.response.use((response) => {
    const requestUrl = new URL(response.config.url ?? BASE_URL, response.config.baseURL ?? BASE_URL).toString();
    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    for (const cookie of cookies) {
        jar.setCookieSync(cookie, requestUrl);
    }
    return response;
});

export async function getXsrfToken(): Promise<string | undefined> {
    const cookies = await jar.getCookies(BASE_URL);
    const xsrfCookie = cookies.find(c => c.key === 'XSRF-TOKEN');
    if (xsrfCookie) {
        return decodeURIComponent(xsrfCookie.value);
    }
    return undefined;
}
