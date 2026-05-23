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
const PROBE_DIR = path.join(REPORT_DIR, 'endpoint-probes');

const EXAMS = [
    { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
    { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
    { name: 'End Term', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
    { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' },
];

interface ProbeResult {
    label: string;
    method: 'GET' | 'HEAD' | 'POST';
    path: string;
    status: number | string;
    contentType?: string;
    finalUrl?: string;
    bodyKind?: string;
    topLevelKeys?: string[];
    component?: string;
    propKeys?: string[];
    arrayLength?: number;
    sample?: unknown;
    note?: string;
}

function ensureDirs() {
    fs.mkdirSync(PROBE_DIR, { recursive: true });
}

function parseInertia(html: string) {
    const $ = cheerio.load(html);
    const raw = $('#app').attr('data-page');
    return raw ? JSON.parse(raw) as InertiaPage : null;
}

function summarizeBody(data: unknown): Pick<ProbeResult, 'bodyKind' | 'topLevelKeys' | 'component' | 'propKeys' | 'arrayLength' | 'sample'> {
    if (Array.isArray(data)) {
        return {
            bodyKind: 'array',
            arrayLength: data.length,
            sample: data.slice(0, 2),
        };
    }
    if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const maybeInertia = data as InertiaPage;
        return {
            bodyKind: 'object',
            topLevelKeys: Object.keys(record),
            component: maybeInertia.component,
            propKeys: maybeInertia.props ? Object.keys(maybeInertia.props) : undefined,
            sample: Object.fromEntries(Object.entries(record).slice(0, 8)),
        };
    }
    if (typeof data === 'string') {
        const page = parseInertia(data);
        if (page) {
            return {
                bodyKind: 'html:inertia',
                component: page.component,
                propKeys: Object.keys(page.props),
                sample: {
                    component: page.component,
                    url: page.url,
                    props: Object.keys(page.props),
                },
            };
        }
        return {
            bodyKind: 'string',
            sample: data.slice(0, 500),
        };
    }
    return {
        bodyKind: typeof data,
        sample: data,
    };
}

function errorResult(label: string, method: ProbeResult['method'], routePath: string, error: unknown): ProbeResult {
    const candidate = error as {
        response?: { status?: number; headers?: Record<string, unknown>; data?: unknown; request?: { responseURL?: string } };
        code?: string;
        message?: string;
    };
    return {
        label,
        method,
        path: routePath,
        status: candidate.response?.status ?? candidate.code ?? 'ERROR',
        contentType: candidate.response?.headers?.['content-type'] ? String(candidate.response.headers['content-type']) : undefined,
        finalUrl: candidate.response?.request?.responseURL,
        note: candidate.message,
        ...summarizeBody(candidate.response?.data),
    };
}

async function probeGet(label: string, routePath: string, headers: Record<string, string> = {}): Promise<ProbeResult> {
    try {
        const response = await client.get(`${BASE_URL}${routePath}`, { headers, maxContentLength: 1_000_000 }) as AxiosResponse<unknown>;
        return {
            label,
            method: 'GET',
            path: routePath,
            status: response.status,
            contentType: response.headers['content-type'] ? String(response.headers['content-type']) : undefined,
            finalUrl: response.request?.responseURL,
            ...summarizeBody(response.data),
        };
    } catch (error) {
        return errorResult(label, 'GET', routePath, error);
    }
}

async function probeHead(label: string, routePath: string): Promise<ProbeResult> {
    try {
        const response = await client.head(`${BASE_URL}${routePath}`) as AxiosResponse<unknown>;
        return {
            label,
            method: 'HEAD',
            path: routePath,
            status: response.status,
            contentType: response.headers['content-type'] ? String(response.headers['content-type']) : undefined,
            finalUrl: response.request?.responseURL,
        };
    } catch (error) {
        return errorResult(label, 'HEAD', routePath, error);
    }
}

async function getSampleQuestionIds() {
    const samples: Array<{
        examName: string;
        courseId: number;
        courseName: string;
        paperUuid: string;
        paperId: number;
        questionId: number;
        questionUuid: string;
        questionType: string;
        solutionsCount: number;
        commentsCount: number;
    }> = [];

    for (const examTarget of EXAMS) {
        const examResponse = await client.get(`${BASE_URL}/exam/${examTarget.uuid}`) as AxiosResponse<string>;
        const page = parseInertia(examResponse.data);
        const exam = page?.props.exam;
        const course = (page?.props.courses as Course[] | undefined)?.[0];
        if (!page || !exam?.en_id || !course) continue;

        const xsrf = await getXsrfToken();
        const paperIndex = await client.post(`${BASE_URL}/api/get-questions-paper-by-exam`, {
            course_id: course.id,
            year: 'all',
            exam_id: exam.en_id,
        }, {
            headers: xsrf ? { 'X-XSRF-TOKEN': xsrf } : {},
        }) as AxiosResponse<unknown>;
        const papers = Array.isArray(paperIndex.data)
            ? paperIndex.data.flatMap((group: { question_papers?: QuestionPaper[] }) => Array.isArray(group.question_papers) ? group.question_papers : [])
            : [];
        const paper = papers[0];
        if (!paper) continue;

        const paperResponse = await client.get(`${BASE_URL}/question-paper/practise/${course.id}/${paper.uuid}`, {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': page.version,
            },
        }) as AxiosResponse<InertiaPage>;
        const questionPaper = paperResponse.data.props.question_paper as { questions?: Array<Record<string, unknown>> } | undefined;
        const question = questionPaper?.questions?.[0];
        if (!question) continue;

        samples.push({
            examName: exam.exam_name,
            courseId: course.id,
            courseName: course.course_name,
            paperUuid: paper.uuid,
            paperId: paper.id,
            questionId: Number(question.id),
            questionUuid: String(question.uuid),
            questionType: String(question.question_type),
            solutionsCount: Number(question.solutions_count ?? 0),
            commentsCount: Number(question.comments_count ?? 0),
        });
    }

    return samples;
}

function table(headers: string[], rows: Array<Array<string | number | undefined | null>>) {
    const widths = headers.map((header, index) =>
        Math.max(header.length, ...rows.map((row) => String(row[index] ?? '').length)),
    );
    return [
        `| ${headers.map((header, index) => header.padEnd(widths[index]!)).join(' | ')} |`,
        `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
        ...rows.map((row) => `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index]!)).join(' | ')} |`),
    ].join('\n');
}

async function main() {
    ensureDirs();
    const samples = await getSampleQuestionIds();
    const results: ProbeResult[] = [];

    const staticGets: Array<[string, string]> = [
        ['Course API', '/api/get_courses'],
        ['Topics API', '/api/topics'],
        ['AI solutions API', '/api/get_ai_solutions'],
        ['Question repository page', '/questions/repository'],
        ['Python practise page', '/python/practise'],
    ];

    for (const [label, routePath] of staticGets) {
        results.push(await probeGet(label, routePath));
    }

    for (const sample of samples) {
        results.push(await probeGet(`${sample.examName} view question`, `/question-paper/view-question/${sample.questionId}`));
        results.push(await probeGet(`${sample.examName} solutions`, `/questions/${sample.questionId}/solution`));
        results.push(await probeGet(`${sample.examName} comments`, `/questions/${sample.questionId}/comments`));
        results.push(await probeGet(`${sample.examName} corrections`, `/questions/${sample.questionId}/corrections`));
        results.push(await probeGet(`${sample.examName} topic stats`, `/api/questions/${sample.questionId}/topic-stats`));
        results.push(await probeHead(`${sample.examName} paper download`, `/question-paper/download/${sample.courseId}/${sample.paperUuid}`));
        results.push(await probeHead(`${sample.examName} paper PDF`, `/question-paper/download-pdf/${sample.courseId}/${sample.paperUuid}`));
    }

    const jsonReport = {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        samples,
        results,
    };

    const md = `# QuizPractice Endpoint Probe Results

Generated: ${jsonReport.generatedAt}

## Sample IDs

${table(['Exam', 'Course', 'Paper UUID', 'Question ID', 'Question UUID', 'Type', 'Solutions', 'Comments'], samples.map((sample) => [
        sample.examName,
        `${sample.courseName} (${sample.courseId})`,
        sample.paperUuid,
        sample.questionId,
        sample.questionUuid,
        sample.questionType,
        sample.solutionsCount,
        sample.commentsCount,
    ]))}

## Probe Summary

${table(['Label', 'Method', 'Path', 'Status', 'Body', 'Component/Keys'], results.map((result) => [
        result.label,
        result.method,
        result.path,
        result.status,
        result.bodyKind,
        result.component ?? result.topLevelKeys?.join(', ') ?? result.propKeys?.join(', ') ?? '',
    ]))}

## Notes

- \`html:inertia\` means the endpoint returned an Inertia page, not raw JSON.
- \`401\`, \`403\`, or redirects indicate auth/subscription protection.
- \`404\` on old guessed API paths should not be considered absence of data if Ziggy exposes a newer route.
- HEAD checks avoid downloading full papers/PDFs while confirming route existence.
`;

    fs.writeFileSync(path.join(PROBE_DIR, 'endpoint-probes.json'), `${JSON.stringify(jsonReport, null, 2)}\n`);
    fs.writeFileSync(path.join(PROBE_DIR, 'endpoint-probes.md'), md);
    console.log(md);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
