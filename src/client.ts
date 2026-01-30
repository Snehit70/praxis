import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export const jar = new CookieJar();
export const client = wrapper(axios.create({
    // @ts-ignore
    jar,
    withCredentials: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
    }
}));

export async function getXsrfToken(): Promise<string | undefined> {
    const cookies = await jar.getCookies('https://quizpractice.space');
    const xsrfCookie = cookies.find(c => c.key === 'XSRF-TOKEN');
    if (xsrfCookie) {
        return decodeURIComponent(xsrfCookie.value);
    }
    return undefined;
}
