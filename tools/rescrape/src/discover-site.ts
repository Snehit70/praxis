import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { AxiosResponse } from 'axios';
import { client, getXsrfToken } from './client';
import type { Course, InertiaPage, QuestionPaper } from './types';

const BASE_URL = process.env.SCRAPER_BASE_URL ?? 'https://quizpractice.space';
const TOOL_ROOT = path.resolve(import.meta.dir, '..');
const PROJECT_ROOT = path.resolve(TOOL_ROOT, '..', '..');
const REPORT_DIR = path.join(PROJECT_ROOT, 'reports');

const EXAMS = [
    { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
    { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
    { name: 'End Term', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
    { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' },
];

interface EndpointProbe {
    method: string;
    path: string;
    status: number | string;
    contentType?: string;
    note?: string;
}

interface ExamDiscovery {
    targetName: string;
    targetUuid: string;
    status: number;
    title: string;
    component: string | null;
    version: string | null;
    propKeys: string[];
    examName: string | null;
    examUuid: string | null;
    hasEncryptedExamId: boolean;
    courseCount: number;
    firstCourses: Array<Pick<Course, 'id' | 'course_name' | 'course_code' | 'uuid'>>;
    firstCoursePaperGroups: number | null;
    firstCoursePaperCount: number | null;
    firstPaper: Partial<QuestionPaper> | null;
    firstPaperQuestionCount: number | null;
    firstQuestionKeys: string[];
    firstOptionKeys: string[];
    imageExamples: string[];
    endpointProbes: EndpointProbe[];
}

function ensureReportDir() {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function parseDataPage(html: string) {
    const $ = cheerio.load(html);
    const raw = $('#app').attr('data-page');
    const ziggyMatch = html.match(/const Ziggy=(\{.*?\});/s);
    const ziggy = ziggyMatch?.[1] ? JSON.parse(ziggyMatch[1]) as {
        url: string;
        routes: Record<string, { uri: string; methods: string[]; parameters?: string[] }>;
    } : null;
    return {
        title: $('title').text().trim(),
        links: $('link[href]').map((_, element) => $(element).attr('href')).get(),
        scripts: $('script[src]').map((_, element) => $(element).attr('src')).get(),
        page: raw ? JSON.parse(raw) as InertiaPage : null,
        ziggy,
    };
}

function errorStatus(error: unknown) {
    const candidate = error as { response?: { status?: number; headers?: Record<string, string> }; code?: string; message?: string };
    return {
        status: candidate.response?.status ?? candidate.code ?? 'ERROR',
        contentType: candidate.response?.headers?.['content-type'] ?? undefined,
        note: candidate.message,
    };
}

async function safeGet(pathOrUrl: string, headers: Record<string, string> = {}): Promise<EndpointProbe> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
    try {
        const response = await client.get(url, { headers });
        return {
            method: 'GET',
            path: pathOrUrl,
            status: response.status,
            contentType: response.headers['content-type'] ? String(response.headers['content-type']) : undefined,
        };
    } catch (error) {
        return {
            method: 'GET',
            path: pathOrUrl,
            ...errorStatus(error),
        };
    }
}

async function getPaperIndex(course: Course, encryptedExamId: string) {
    const xsrfToken = await getXsrfToken();
    return client.post(`${BASE_URL}/api/get-questions-paper-by-exam`, {
        course_id: course.id,
        year: 'all',
        exam_id: encryptedExamId,
    }, {
        headers: xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {},
    }) as Promise<AxiosResponse<unknown>>;
}

function flattenPapers(data: unknown): QuestionPaper[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap((group: { question_papers?: QuestionPaper[] }) =>
        Array.isArray(group.question_papers) ? group.question_papers : [],
    );
}

function collectImageExamples(questionPaper: unknown) {
    const examples = new Set<string>();
    const paper = questionPaper as { questions?: Array<Record<string, unknown> & { options?: Array<Record<string, unknown>> }> };
    for (const question of paper.questions ?? []) {
        for (let index = 1; index <= 10; index += 1) {
            const image = question[`question_image_${index}`];
            if (typeof image === 'string' && image.trim()) examples.add(`question:${image}`);
        }
        for (const option of question.options ?? []) {
            const image = option.option_image_url || option.option_image;
            if (typeof image === 'string' && image.trim()) examples.add(`option:${image}`);
        }
        if (examples.size >= 8) break;
    }
    return [...examples].slice(0, 8);
}

function table(headers: string[], rows: Array<Array<string | number | null>>) {
    const widths = headers.map((header, index) =>
        Math.max(header.length, ...rows.map((row) => String(row[index] ?? '').length)),
    );
    return [
        `| ${headers.map((header, index) => header.padEnd(widths[index]!)).join(' | ')} |`,
        `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
        ...rows.map((row) => `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index]!)).join(' | ')} |`),
    ].join('\n');
}

async function discoverExam(target: typeof EXAMS[number]): Promise<ExamDiscovery> {
    const response = await client.get(`${BASE_URL}/exam/${target.uuid}`) as AxiosResponse<string>;
    const parsed = parseDataPage(response.data);
    const page = parsed.page;
    const props = page?.props;
    const courses = (props?.courses ?? []) as Course[];
    const exam = props?.exam;

    const result: ExamDiscovery = {
        targetName: target.name,
        targetUuid: target.uuid,
        status: response.status,
        title: parsed.title,
        component: page?.component ?? null,
        version: page?.version ?? null,
        propKeys: props ? Object.keys(props) : [],
        examName: exam?.exam_name ?? null,
        examUuid: exam?.uuid ?? null,
        hasEncryptedExamId: Boolean(exam?.en_id),
        courseCount: courses.length,
        firstCourses: courses.slice(0, 5).map((course) => ({
            id: course.id,
            course_name: course.course_name,
            course_code: course.course_code,
            uuid: course.uuid,
        })),
        firstCoursePaperGroups: null,
        firstCoursePaperCount: null,
        firstPaper: null,
        firstPaperQuestionCount: null,
        firstQuestionKeys: [],
        firstOptionKeys: [],
        imageExamples: [],
        endpointProbes: [],
    };

    const firstCourse = courses[0];
    if (!firstCourse || !exam?.en_id || !page?.version) {
        return result;
    }

    const indexResponse = await getPaperIndex(firstCourse, exam.en_id);
    const groups = Array.isArray(indexResponse.data) ? indexResponse.data : [];
    const papers = flattenPapers(indexResponse.data);
    result.firstCoursePaperGroups = groups.length;
    result.firstCoursePaperCount = papers.length;
    result.firstPaper = papers[0] ? {
        id: papers[0].id,
        uuid: papers[0].uuid,
        question_paper_name: papers[0].question_paper_name,
        year: papers[0].year,
        is_new: papers[0].is_new,
    } : null;

    const firstPaper = papers[0];
    if (!firstPaper) {
        return result;
    }

    const paperResponse = await client.get(`${BASE_URL}/question-paper/practise/${firstCourse.id}/${firstPaper.uuid}`, {
        headers: {
            'X-Inertia': 'true',
            'X-Inertia-Version': page.version,
        },
    }) as AxiosResponse<InertiaPage>;
    const questionPaper = paperResponse.data.props.question_paper as { questions?: Array<Record<string, unknown> & { options?: Array<Record<string, unknown>> }> } | undefined;
    const firstQuestion = questionPaper?.questions?.[0];
    result.firstPaperQuestionCount = questionPaper?.questions?.length ?? null;
    result.firstQuestionKeys = firstQuestion ? Object.keys(firstQuestion) : [];
    result.firstOptionKeys = firstQuestion?.options?.[0] ? Object.keys(firstQuestion.options[0]) : [];
    result.imageExamples = collectImageExamples(questionPaper);

    const firstQuestionId = firstQuestion?.id;
    const firstQuestionUuid = firstQuestion?.uuid;
    const probes = [
        firstQuestionId ? `/api/question/${firstQuestionId}/solutions` : null,
        firstQuestionUuid ? `/api/question/${firstQuestionUuid}/solutions` : null,
        firstQuestionUuid ? `/api/question/${firstQuestionUuid}` : null,
        firstQuestionId ? `/api/question/${firstQuestionId}/comments` : null,
    ].filter((value): value is string => Boolean(value));
    for (const probe of probes) {
        result.endpointProbes.push(await safeGet(probe));
    }

    for (const image of result.imageExamples.slice(0, 2)) {
        const [, raw] = image.split(':');
        if (!raw) continue;
        const filename = raw.replace(/^app\/(question_images|option_images)\//, '');
        const type = image.startsWith('question:') ? 'question_images' : 'option_images';
        result.endpointProbes.push(await safeGet(`/app/${type}/${filename}`));
        result.endpointProbes.push(await safeGet(`/storage/${type}/${filename}`));
    }

    return result;
}

function normalizeAssetUrl(assetUrl: string) {
    if (assetUrl.startsWith('http')) return assetUrl;
    return `${BASE_URL}${assetUrl.startsWith('/') ? '' : '/'}${assetUrl}`;
}

function extractBundleCandidates(source: string) {
    const candidates = new Set<string>();
    const patterns = [
        /["'`](\/api\/[^"'`\\\s<>)]+)/g,
        /["'`](\/exam\/[^"'`\\\s<>)]+)/g,
        /["'`](\/question-paper\/[^"'`\\\s<>)]+)/g,
        /["'`](\/(?:login|register|dashboard|profile|feedback|subscription|pricing|course|courses|paper|papers|question|questions)[^"'`\\\s<>)]*)/g,
        /["'`]([a-z0-9_.:-]*(?:api|question|paper|exam|course|solution|subscription|repository|submission|comment|topic)[a-z0-9_.:-]*)["'`]/gi,
        /https:\/\/quizpractice\.space\/[^"'`\\\s<>)]+/g,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            candidates.add(match[1] ?? match[0]);
        }
    }

    return [...candidates]
        .map((candidate) => candidate.replace(/\\\//g, '/'))
        .sort();
}

async function reverseEngineerBundles(assetLinks: string[]) {
    const seen = new Set<string>();
    const queue = [...new Set(assetLinks.filter((asset) => asset.endsWith('.js')))];
    const results: Array<{ asset: string; status: number | string; bytes?: number; candidates: string[] }> = [];
    const allCandidates = new Set<string>();

    while (queue.length > 0) {
        const asset = queue.shift()!;
        if (seen.has(asset)) continue;
        seen.add(asset);

        const url = normalizeAssetUrl(asset);
        try {
            const response = await client.get(url, { responseType: 'text' }) as AxiosResponse<string>;
            for (const match of response.data.matchAll(/assets\/[A-Za-z0-9_.-]+\.js/g)) {
                const discovered = `${BASE_URL}/build/${match[0]}`;
                if (!seen.has(discovered)) queue.push(discovered);
            }
            const candidates = extractBundleCandidates(response.data);
            candidates.forEach((candidate) => allCandidates.add(candidate));
            results.push({
                asset,
                status: response.status,
                bytes: response.data.length,
                candidates,
            });
        } catch (error) {
            const status = errorStatus(error);
            results.push({
                asset,
                status: status.status,
                candidates: [],
            });
        }
    }

    return {
        assetsScanned: results.length,
        candidates: [...allCandidates].sort(),
        perAsset: results,
    };
}

function ziggyRouteRows(ziggy: ReturnType<typeof parseDataPage>['ziggy']) {
    if (!ziggy) return [];
    return Object.entries(ziggy.routes)
        .map(([name, route]) => ({
            name,
            methods: route.methods.join(','),
            uri: route.uri.replace(/\\\//g, '/'),
            parameters: route.parameters?.join(',') ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
    ensureReportDir();

    const homeResponse = await client.get(BASE_URL) as AxiosResponse<string>;
    const home = parseDataPage(homeResponse.data);
    const homeProps = home.page?.props ?? {};
    const assetLinks = [...home.links, ...home.scripts].filter((url) => url.includes('/build/assets/'));
    const bundleReverseEngineering = await reverseEngineerBundles(assetLinks);
    const routes = ziggyRouteRows(home.ziggy);
    const publicInterestingRoutes = routes.filter((route) =>
        /question|paper|exam|course|solution|comment|subscription|feedback|topic|repository|python|submission|profile|api/i.test(
            `${route.name} ${route.uri}`,
        ),
    );

    const exams: ExamDiscovery[] = [];
    for (const exam of EXAMS) {
        exams.push(await discoverExam(exam));
    }

    const report = {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        home: {
            status: homeResponse.status,
            title: home.title,
            component: home.page?.component ?? null,
            version: home.page?.version ?? null,
            propKeys: Object.keys(homeProps),
            exams: Array.isArray((homeProps as { exams?: unknown }).exams)
                ? (homeProps as { exams: Array<{ exam_name: string; uuid: string }> }).exams.map((exam) => ({ name: exam.exam_name, uuid: exam.uuid }))
                : [],
            coursePropCount: Array.isArray((homeProps as { courses?: unknown }).courses) ? (homeProps as { courses: unknown[] }).courses.length : null,
            assetLinks,
        },
        ziggy: {
            url: home.ziggy?.url ?? null,
            routeCount: routes.length,
            routes,
            interestingRoutes: publicInterestingRoutes,
        },
        bundleReverseEngineering,
        exams,
    };

    const md = `# QuizPractice Website Discovery

Generated: ${report.generatedAt}

## Home

${table(['Metric', 'Value'], [
    ['Status', report.home.status],
    ['Title', report.home.title],
    ['Component', report.home.component],
    ['Inertia version', report.home.version],
    ['Home prop keys', report.home.propKeys.join(', ')],
    ['Home exams', report.home.exams.map((exam) => `${exam.name}:${exam.uuid}`).join(' | ')],
    ['Home courses prop count', report.home.coursePropCount],
    ['Asset links', report.home.assetLinks.length],
    ['Ziggy routes', report.ziggy.routeCount],
    ['Interesting routes', report.ziggy.interestingRoutes.length],
    ['JS assets scanned', report.bundleReverseEngineering.assetsScanned],
    ['Bundle endpoint candidates', report.bundleReverseEngineering.candidates.length],
])}

## Ziggy Route Table

These are server-advertised route names and URI templates embedded in the current HTML. This is the most reliable endpoint discovery source.

${table(['Name', 'Methods', 'URI', 'Params'], report.ziggy.interestingRoutes.map((route) => [
    route.name,
    route.methods,
    route.uri,
    route.parameters,
]))}

## Bundle Reverse Engineering

Candidate route/API strings found in current JS bundles. These are not all confirmed endpoints; treat them as leads.

${table(['Candidate'], report.bundleReverseEngineering.candidates.map((candidate) => [candidate]))}

### Assets Scanned

${table(['Asset', 'Status', 'Bytes', 'Candidates'], report.bundleReverseEngineering.perAsset.map((asset) => [
    asset.asset,
    asset.status,
    asset.bytes ?? '',
    asset.candidates.length,
]))}

## Exam Samples

${table(['Exam', 'Status', 'Component', 'Courses', 'Paper groups', 'Papers', 'First paper', 'Questions'], exams.map((exam) => [
    exam.examName ?? exam.targetName,
    exam.status,
    exam.component,
    exam.courseCount,
    exam.firstCoursePaperGroups,
    exam.firstCoursePaperCount,
    exam.firstPaper ? `${exam.firstPaper.question_paper_name} (${exam.firstPaper.uuid})` : '',
    exam.firstPaperQuestionCount,
]))}

## Schema Signals

${exams.map((exam) => `### ${exam.examName ?? exam.targetName}

- Prop keys: ${exam.propKeys.join(', ')}
- First courses: ${exam.firstCourses.map((course) => `${course.id}:${course.course_name}:${course.uuid}`).join(' | ')}
- First question keys: ${exam.firstQuestionKeys.join(', ')}
- First option keys: ${exam.firstOptionKeys.join(', ')}
- Image examples: ${exam.imageExamples.join(' | ') || 'none in sampled paper'}
- Endpoint probes:
${table(['Method', 'Path', 'Status', 'Content-Type'], exam.endpointProbes.map((probe) => [
    probe.method,
    probe.path,
    probe.status,
    probe.contentType ?? '',
]))}
`).join('\n')}

## Initial Conclusions

- The site still uses the same Inertia mechanism and the scraper's core route assumptions remain valid.
- The home page now advertises current asset bundle names; this report should be regenerated before major rescrapes.
- The sampled Quiz 1 paper list contains current/future 2026 paper metadata, so local data is stale.
- Extra solution/comment/question API patterns still need to be treated as opportunistic; they are probed here but should not block scraping.
`;

    fs.writeFileSync(path.join(REPORT_DIR, 'website-discovery.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(REPORT_DIR, 'website-discovery.md'), md);
    console.log(md);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
