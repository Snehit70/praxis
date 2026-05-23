import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { client, getXsrfToken } from './client';
import { Course, InertiaPage, QuestionPaper } from './types';
import { AdaptiveRateLimiter } from './rate-limiter';

const BASE_URL = process.env.SCRAPER_BASE_URL ?? 'https://quizpractice.space';
const TOOL_ROOT = path.resolve(import.meta.dir, '..');
const PROJECT_ROOT = path.resolve(TOOL_ROOT, '..', '..');
const DATA_DIR = process.env.SCRAPER_OUTPUT_DIR
    ? path.resolve(process.env.SCRAPER_OUTPUT_DIR)
    : path.join(PROJECT_ROOT, 'data-new');
const EXISTING_DATA_DIR = process.env.SCRAPER_EXISTING_DATA_DIR
    ? path.resolve(process.env.SCRAPER_EXISTING_DATA_DIR)
    : path.join(PROJECT_ROOT, 'data');
const FORCE_REFRESH = process.env.SCRAPER_FORCE === '1';
const USE_EXISTING_CACHE = process.env.SCRAPER_USE_EXISTING_CACHE !== '0';
const MAX_RETRIES = Number.parseInt(process.env.SCRAPER_MAX_RETRIES ?? '3', 10);
const KNOWN_FAILURES_FILE = process.env.SCRAPER_KNOWN_FAILURES_FILE
    ? path.resolve(process.env.SCRAPER_KNOWN_FAILURES_FILE)
    : path.join(DATA_DIR, 'scrape-known-failures.json');
const KNOWN_FAILURE_THRESHOLD = Number.parseInt(process.env.SCRAPER_KNOWN_FAILURE_THRESHOLD ?? '3', 10);
const RETRY_KNOWN_FAILURES = process.env.SCRAPER_RETRY_KNOWN_FAILURES === '1';
const REUSE_INDEX_CACHE = process.env.SCRAPER_REUSE_INDEX_CACHE !== '0';
const RESUME_FILE = process.env.SCRAPER_RESUME_FILE
    ? path.resolve(process.env.SCRAPER_RESUME_FILE)
    : path.join(DATA_DIR, 'scrape-resume-state.json');

const EXAMS = [
    { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
    { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
    { name: 'End Term', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
    { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' }
];

interface ScrapeFailure {
    stage: 'exam' | 'paper-index' | 'paper' | 'paper-quarantine';
    examName: string;
    courseId?: number;
    courseName?: string;
    paperUuid?: string;
    path?: string;
    error: string;
}

interface ExamCacheData {
    exam: InertiaPage['props']['exam'];
    courses: Course[];
    pageVersion?: string;
}

interface ResumeState {
    completedCourses: Record<string, {
        examName: string;
        courseName: string;
        completedAt: string;
        paperCount: number;
    }>;
}

interface CourseManifestEntry {
    examName: string;
    examUuid: string;
    examDir: string;
    courseId: number;
    courseUuid: string;
    courseName: string;
    courseCode: string;
    courseDir: string;
    indexPath: string;
    paperCount: number;
}

interface ScrapeSummary {
    startedAt: string;
    finishedAt?: string;
    baseUrl: string;
    outputDir: string;
    requestTimeoutMs: number;
    maxRetries: number;
    forceRefresh: boolean;
    useExistingCache: boolean;
    existingDataDir: string;
    knownFailuresFile: string;
    knownFailureThreshold: number;
    retryKnownFailures: boolean;
    reuseIndexCache: boolean;
    resumeFile: string;
    examsSeen: number;
    coursesSeen: number;
    paperIndexCount: number;
    paperIndexCacheHits: number;
    coursesSkippedByResume: number;
    papersDiscovered: number;
    papersFetched: number;
    papersSkipped: number;
    papersCopiedFromExisting: number;
    papersSkippedKnownFailed: number;
    papersFailed: number;
    failures: ScrapeFailure[];
}

interface KnownFailureEntry {
    key: string;
    examName: string;
    courseId: number;
    courseName: string;
    paperUuid: string;
    path: string;
    questionPaperName: string;
    failureCount: number;
    firstFailedAt: string;
    lastFailedAt: string;
    lastError: string;
    lastStatus?: number;
}

type KnownFailureMap = Record<string, KnownFailureEntry>;

function errorMessage(error: unknown) {
    const candidate = error as { response?: { status?: number; statusText?: string }; code?: string; message?: string };
    if (candidate.response?.status) {
        return `HTTP ${candidate.response.status}${candidate.response.statusText ? ` ${candidate.response.statusText}` : ''}`;
    }
    if (candidate.code) {
        return candidate.message ? `${candidate.code}: ${candidate.message}` : candidate.code;
    }
    return candidate.message ?? String(error);
}

function errorStatus(error: unknown) {
    return (error as { response?: { status?: number } }).response?.status;
}

function knownFailureKey(examName: string, courseId: number, paperUuid: string) {
    return `${examName}::${courseId}::${paperUuid}`;
}

function loadKnownFailures(): KnownFailureMap {
    if (!fs.existsSync(KNOWN_FAILURES_FILE)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(KNOWN_FAILURES_FILE, 'utf8')) as KnownFailureMap;
    } catch (error) {
        console.error(`Warning: failed to read known failure cache ${KNOWN_FAILURES_FILE}: ${errorMessage(error)}`);
        return {};
    }
}

function saveKnownFailures(knownFailures: KnownFailureMap) {
    const dir = path.dirname(KNOWN_FAILURES_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(KNOWN_FAILURES_FILE, JSON.stringify(knownFailures, null, 2));
}

function shouldQuarantineKnownFailure(entry: KnownFailureEntry | undefined) {
    if (RETRY_KNOWN_FAILURES || FORCE_REFRESH || !entry) {
        return false;
    }

    return entry.failureCount >= KNOWN_FAILURE_THRESHOLD;
}

function recordKnownFailure(
    knownFailures: KnownFailureMap,
    details: {
        examName: string;
        courseId: number;
        courseName: string;
        paperUuid: string;
        path: string;
        questionPaperName: string;
        error: unknown;
    },
) {
    const status = errorStatus(details.error);

    // Client/rate-limit/network failures are worth retrying later. Persistent upstream 5xx pages are the ones
    // that otherwise make every auto-run loop revisit the same missing paper forever.
    if (!status || status < 500) {
        return;
    }

    const now = new Date().toISOString();
    const key = knownFailureKey(details.examName, details.courseId, details.paperUuid);
    const existing = knownFailures[key];
    knownFailures[key] = {
        key,
        examName: details.examName,
        courseId: details.courseId,
        courseName: details.courseName,
        paperUuid: details.paperUuid,
        path: details.path,
        questionPaperName: details.questionPaperName,
        failureCount: (existing?.failureCount ?? 0) + 1,
        firstFailedAt: existing?.firstFailedAt ?? now,
        lastFailedAt: now,
        lastError: errorMessage(details.error),
        lastStatus: status,
    };
}

function clearKnownFailure(knownFailures: KnownFailureMap, examName: string, courseId: number, paperUuid: string) {
    delete knownFailures[knownFailureKey(examName, courseId, paperUuid)];
}

function resumeKey(examUuid: string, courseId: number) {
    return `${examUuid}::${courseId}`;
}

function loadResumeState(): ResumeState {
    if (!fs.existsSync(RESUME_FILE) || FORCE_REFRESH) {
        return { completedCourses: {} };
    }

    try {
        return JSON.parse(fs.readFileSync(RESUME_FILE, 'utf8')) as ResumeState;
    } catch (error) {
        console.error(`Warning: failed to read resume state ${RESUME_FILE}: ${errorMessage(error)}`);
        return { completedCourses: {} };
    }
}

function saveResumeState(resumeState: ResumeState) {
    const dir = path.dirname(RESUME_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RESUME_FILE, JSON.stringify(resumeState, null, 2));
}

function markCourseComplete(
    resumeState: ResumeState,
    examUuid: string,
    course: Course,
    details: { examName: string; paperCount: number },
) {
    resumeState.completedCourses[resumeKey(examUuid, course.id)] = {
        examName: details.examName,
        courseName: course.course_name,
        completedAt: new Date().toISOString(),
        paperCount: details.paperCount,
    };
    saveResumeState(resumeState);
}

function readJsonFile<T>(filePath: string): T | undefined {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        return undefined;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch (error) {
        console.error(`Warning: failed to read ${filePath}: ${errorMessage(error)}`);
        return undefined;
    }
}

function readCachedExamData(examTarget: { uuid: string }) {
    if (!REUSE_INDEX_CACHE || FORCE_REFRESH) {
        return undefined;
    }

    for (const examDirName of fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : []) {
        const metadataPath = path.join(DATA_DIR, examDirName, 'metadata.json');
        const cached = readJsonFile<ExamCacheData>(metadataPath);
        if (cached?.exam?.uuid === examTarget.uuid && Array.isArray(cached.courses)) {
            return cached;
        }
    }

    return undefined;
}

async function requestWithRetries<T>(
    rateLimiter: AdaptiveRateLimiter,
    label: string,
    request: () => Promise<AxiosResponse<T>>,
) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            await rateLimiter.sleep();
            const response = await request();
            rateLimiter.recordSuccess();
            return response;
        } catch (error) {
            lastError = error;
            if (rateLimiter.isRateLimitError(error)) {
                rateLimiter.recordError(error);
            }

            if (attempt < MAX_RETRIES) {
                console.error(`      ${label} failed (${errorMessage(error)}). Retry ${attempt}/${MAX_RETRIES - 1}...`);
                continue;
            }
        }
    }

    throw lastError;
}

async function saveJson(filePath: string, data: unknown, options: { force?: boolean } = {}) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // Double check to ensure we don't overwrite if it exists (though we skip before calling this)
    if (!options.force && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        return;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function relativeToOutput(filePath: string) {
    return path.relative(DATA_DIR, filePath);
}

function copyFromExistingData(examName: string, courseName: string, paperUuid: string, destinationPath: string) {
    if (!USE_EXISTING_CACHE || FORCE_REFRESH) {
        return false;
    }

    const sourcePath = path.join(EXISTING_DATA_DIR, examName, courseName, `${paperUuid}.json`);
    if (!fs.existsSync(sourcePath) || fs.statSync(sourcePath).size === 0) {
        return false;
    }

    const destinationDir = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
    }

    fs.copyFileSync(sourcePath, destinationPath);
    return true;
}

export async function scrape() {
    console.log('Starting scrape with Adaptive Rate Limiting...');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Output directory: ${DATA_DIR}`);
    console.log(`Existing data cache: ${USE_EXISTING_CACHE ? EXISTING_DATA_DIR : 'disabled'}`);
    console.log(`Known failure cache: ${KNOWN_FAILURES_FILE}`);
    console.log(`Resume state: ${RESUME_FILE}`);
    console.log(`Index cache reuse: ${REUSE_INDEX_CACHE ? 'enabled' : 'disabled'}`);
    const rateLimiter = new AdaptiveRateLimiter();
    const knownFailures = loadKnownFailures();
    const resumeState = loadResumeState();
    const summary: ScrapeSummary = {
        startedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        outputDir: DATA_DIR,
        requestTimeoutMs: Number.parseInt(process.env.SCRAPER_REQUEST_TIMEOUT_MS ?? '30000', 10),
        maxRetries: MAX_RETRIES,
        forceRefresh: FORCE_REFRESH,
        useExistingCache: USE_EXISTING_CACHE,
        existingDataDir: EXISTING_DATA_DIR,
        knownFailuresFile: KNOWN_FAILURES_FILE,
        knownFailureThreshold: KNOWN_FAILURE_THRESHOLD,
        retryKnownFailures: RETRY_KNOWN_FAILURES,
        reuseIndexCache: REUSE_INDEX_CACHE,
        resumeFile: RESUME_FILE,
        examsSeen: 0,
        coursesSeen: 0,
        paperIndexCount: 0,
        paperIndexCacheHits: 0,
        coursesSkippedByResume: 0,
        papersDiscovered: 0,
        papersFetched: 0,
        papersSkipped: 0,
        papersCopiedFromExisting: 0,
        papersSkippedKnownFailed: 0,
        papersFailed: 0,
        failures: [],
    };
    const courseManifest: CourseManifestEntry[] = [];

    for (const examTarget of EXAMS) {
        console.log(`\nProcessing Exam: ${examTarget.name} (${examTarget.uuid})`);

        try {
            const cachedExamData = readCachedExamData(examTarget);
            let pageVersion: string | undefined;
            let courses: Course[] | undefined;
            let exam: InertiaPage['props']['exam'] | undefined;

            if (cachedExamData) {
                exam = cachedExamData.exam;
                courses = cachedExamData.courses;
                pageVersion = cachedExamData.pageVersion;
                console.log(`Using cached exam metadata for ${examTarget.name}.`);
            } else {
                const examUrl = `${BASE_URL}/exam/${examTarget.uuid}`;
                const response = await requestWithRetries<string>(
                    rateLimiter,
                    `Exam fetch ${examTarget.name}`,
                    () => client.get(examUrl) as Promise<AxiosResponse<string>>,
                );

                const $ = cheerio.load(response.data as string);
                const dataPage = $('#app').attr('data-page');

                if (!dataPage) {
                    console.error(`No data-page attribute found for ${examTarget.name}`);
                    continue;
                }

                const pageData = JSON.parse(dataPage) as InertiaPage;
                courses = pageData.props.courses;
                exam = pageData.props.exam;
                pageVersion = pageData.version;
            }

            if (!exam || !courses) {
                console.error(`Failed to get exam data for ${examTarget.name}`);
                continue;
            }

            console.log(`Found ${courses.length} courses.`);
            summary.examsSeen += 1;
            summary.coursesSeen += courses.length;

            // Save metadata
            const examDir = path.join(DATA_DIR, exam.exam_name);
            await saveJson(path.join(examDir, 'metadata.json'), { exam, courses, pageVersion }, { force: FORCE_REFRESH });

            // 2. Iterate courses to get Question Papers
            for (const course of courses as Course[]) {
                console.log(`  Scraping Course: ${course.course_name} (ID: ${course.id})`);
                const courseDir = path.join(examDir, course.course_name);
                const indexPath = path.join(courseDir, 'index.json');
                const courseResumeKey = resumeKey(exam.uuid, course.id);
                const cachedCompletedCourse = resumeState.completedCourses[courseResumeKey];

                if (!FORCE_REFRESH && !RETRY_KNOWN_FAILURES && cachedCompletedCourse && fs.existsSync(indexPath) && fs.statSync(indexPath).size > 0) {
                    console.log(`    Skipping completed course from resume state (${cachedCompletedCourse.paperCount} papers).`);
                    summary.coursesSkippedByResume += 1;
                    continue;
                }

                let allPapers: QuestionPaper[] = [];
                const cachedIndex = !FORCE_REFRESH && REUSE_INDEX_CACHE ? readJsonFile<QuestionPaper[]>(indexPath) : undefined;
                if (cachedIndex && Array.isArray(cachedIndex)) {
                    allPapers = cachedIndex;
                    summary.paperIndexCacheHits += 1;
                    console.log(`    Using cached course index (${allPapers.length} question papers).`);
                } else {
                    const xsrfToken = await getXsrfToken();
                    if (!xsrfToken) {
                        console.error('  Failed to get XSRF token');
                        continue;
                    }

                    let qpResponse: AxiosResponse<unknown>;
                    try {
                        qpResponse = await requestWithRetries<unknown>(
                            rateLimiter,
                            `Paper index ${exam.exam_name}/${course.course_name}`,
                            () => client.post(`${BASE_URL}/api/get-questions-paper-by-exam`, {
                                course_id: course.id,
                                year: 'all',
                                exam_id: exam.en_id
                            }, {
                                headers: {
                                    'X-XSRF-TOKEN': xsrfToken
                                }
                            }),
                        );
                    } catch (error) {
                        summary.failures.push({
                            stage: 'paper-index',
                            examName: exam.exam_name,
                            courseId: course.id,
                            courseName: course.course_name,
                            error: errorMessage(error),
                        });
                        console.error(`    Failed to fetch paper index: ${errorMessage(error)}`);
                        continue;
                    }

                    if (Array.isArray(qpResponse.data)) {
                         qpResponse.data.forEach((group: { question_papers?: QuestionPaper[] }) => {
                            if (group.question_papers && Array.isArray(group.question_papers)) {
                                allPapers.push(...group.question_papers);
                            }
                         });
                    }
                }

                console.log(`    Found ${allPapers.length} question papers.`);
                summary.paperIndexCount += 1;
                summary.papersDiscovered += allPapers.length;

                // Save Course Index
                await saveJson(indexPath, allPapers, { force: FORCE_REFRESH });
                courseManifest.push({
                    examName: exam.exam_name,
                    examUuid: exam.uuid,
                    examDir: relativeToOutput(examDir),
                    courseId: course.id,
                    courseUuid: course.uuid,
                    courseName: course.course_name,
                    courseCode: course.course_code,
                    courseDir: relativeToOutput(courseDir),
                    indexPath: relativeToOutput(indexPath),
                    paperCount: allPapers.length,
                });

                // 3. Get Questions for each paper
                for (const paper of allPapers) {
                    // RESUME CAPABILITY: Skip if file already exists
                    const filePath = path.join(courseDir, `${paper.uuid}.json`);
                    if (!FORCE_REFRESH && fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
                        // console.log(`      Skipping (Exists): ${paper.question_paper_name}`);
                        summary.papersSkipped += 1;
                        continue;
                    }

                    if (copyFromExistingData(exam.exam_name, course.course_name, paper.uuid, filePath)) {
                        summary.papersCopiedFromExisting += 1;
                        clearKnownFailure(knownFailures, exam.exam_name, course.id, paper.uuid);
                        continue;
                    }

                    const knownFailure = knownFailures[knownFailureKey(exam.exam_name, course.id, paper.uuid)];
                    if (shouldQuarantineKnownFailure(knownFailure)) {
                        summary.papersSkippedKnownFailed += 1;
                        summary.failures.push({
                            stage: 'paper-quarantine',
                            examName: exam.exam_name,
                            courseId: course.id,
                            courseName: course.course_name,
                            paperUuid: paper.uuid,
                            path: relativeToOutput(filePath),
                            error: `Skipped after ${knownFailure.failureCount} prior 5xx failures: ${knownFailure.lastError}`,
                        });
                        continue;
                    }

                    console.log(`      Fetching Paper: ${paper.question_paper_name} (${paper.uuid})`);

                    const paperUrl = `${BASE_URL}/question-paper/practise/${course.id}/${paper.uuid}`;

                    try {
                        const paperResponse = await requestWithRetries<InertiaPage>(
                            rateLimiter,
                            `Paper ${paper.uuid}`,
                            () => client.get(paperUrl, {
                                headers: {
                                    'X-Inertia': 'true',
                                    ...(pageVersion ? { 'X-Inertia-Version': pageVersion } : {})
                                }
                            }),
                        );

                        const paperPageData = paperResponse.data as InertiaPage;

                        if (paperPageData.props.question_paper) {
                             await saveJson(filePath, paperPageData.props.question_paper, { force: FORCE_REFRESH });
                             summary.papersFetched += 1;
                             clearKnownFailure(knownFailures, exam.exam_name, course.id, paper.uuid);
                        } else {
                            console.error('      Failed to get questions');
                            summary.papersFailed += 1;
                            summary.failures.push({
                                stage: 'paper',
                                examName: exam.exam_name,
                                courseId: course.id,
                                courseName: course.course_name,
                                paperUuid: paper.uuid,
                                path: relativeToOutput(filePath),
                                error: 'No question_paper prop in Inertia response',
                            });
                        }
                    } catch (error) {
                        summary.papersFailed += 1;
                        summary.failures.push({
                            stage: 'paper',
                            examName: exam.exam_name,
                            courseId: course.id,
                            courseName: course.course_name,
                            paperUuid: paper.uuid,
                            path: relativeToOutput(filePath),
                            error: errorMessage(error),
                        });
                        recordKnownFailure(knownFailures, {
                            examName: exam.exam_name,
                            courseId: course.id,
                            courseName: course.course_name,
                            paperUuid: paper.uuid,
                            path: relativeToOutput(filePath),
                            questionPaperName: paper.question_paper_name,
                            error,
                        });
                        saveKnownFailures(knownFailures);
                        console.error(`      Error fetching paper: ${errorMessage(error)}`);
                    }

                    if ((summary.papersFetched + summary.papersFailed) % 100 === 0) {
                        console.log(`      [Status] Current delay: ${rateLimiter.getCurrentDelay()}, Fetched: ${summary.papersFetched}, Copied: ${summary.papersCopiedFromExisting}, Failed: ${summary.papersFailed}, Skipped: ${summary.papersSkipped}`);
                    }
                }

                markCourseComplete(resumeState, exam.uuid, course, {
                    examName: exam.exam_name,
                    paperCount: allPapers.length,
                });
            }

        } catch (error) {
            if (rateLimiter.isRateLimitError(error)) {
                rateLimiter.recordError(error);
                console.error(`Rate limit hit on ${examTarget.name}. Backing off...`);
                await rateLimiter.sleep();
            } else {
                console.error(`Error scraping ${examTarget.name}:`, errorMessage(error));
            }
            summary.failures.push({
                stage: 'exam',
                examName: examTarget.name,
                error: errorMessage(error),
            });
        }

        await rateLimiter.sleep();
    }
    summary.finishedAt = new Date().toISOString();
    await saveJson(path.join(DATA_DIR, 'scrape-course-manifest.json'), courseManifest, { force: true });
    await saveJson(path.join(DATA_DIR, 'scrape-run-summary.json'), summary, { force: true });
    saveKnownFailures(knownFailures);
    console.log('\nScrape complete!');
    console.log(JSON.stringify(summary, null, 2));
}
