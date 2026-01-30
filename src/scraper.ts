import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { client, getXsrfToken } from './client';
import { InertiaPage, Course, Exam, QuestionPaper } from './types';
import { AdaptiveRateLimiter } from './rate-limiter';

const BASE_URL = 'https://quizpractice.space';
const DATA_DIR = path.join(process.cwd(), 'data');

const EXAMS = [
    { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
    { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
    { name: 'End Term', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
    { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' }
];

async function saveJson(filePath: string, data: any) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    // Double check to ensure we don't overwrite if it exists (though we skip before calling this)
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        return;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function scrape() {
    console.log('Starting scrape with Adaptive Rate Limiting...');
    const rateLimiter = new AdaptiveRateLimiter();
    let requestCount = 0;

    for (const examTarget of EXAMS) {
        console.log(`\nProcessing Exam: ${examTarget.name} (${examTarget.uuid})`);
        
        try {
            await rateLimiter.sleep();
            
            const examUrl = `${BASE_URL}/exam/${examTarget.uuid}`;
            const response = await client.get(examUrl);
            rateLimiter.recordSuccess();
            
            const $ = cheerio.load(response.data as string);
            const dataPage = $('#app').attr('data-page');
            
            if (!dataPage) {
                console.error(`No data-page attribute found for ${examTarget.name}`);
                continue;
            }

            const pageData = JSON.parse(dataPage) as InertiaPage;
            const courses = pageData.props.courses;
            const exam = pageData.props.exam;

            if (!exam || !courses) {
                console.error(`Failed to get exam data for ${examTarget.name}`);
                continue;
            }

            console.log(`Found ${courses.length} courses.`);
            
            // Save metadata
            const examDir = path.join(DATA_DIR, exam.exam_name);
            await saveJson(path.join(examDir, 'metadata.json'), { exam, courses });

            // 2. Iterate courses to get Question Papers
            for (const course of courses) {
                console.log(`  Scraping Course: ${course.course_name} (ID: ${course.id})`);
                
                const xsrfToken = await getXsrfToken();
                if (!xsrfToken) {
                    console.error('  Failed to get XSRF token');
                    continue;
                }

                await rateLimiter.sleep();
                
                const qpResponse = await client.post(`${BASE_URL}/api/get-questions-paper-by-exam`, {
                    course_id: course.id,
                    year: 'all',
                    exam_id: exam.en_id
                }, {
                    headers: {
                        'X-XSRF-TOKEN': xsrfToken
                    }
                });
                rateLimiter.recordSuccess();

                // Flatten the structure (Groups -> QuestionPapers)
                let allPapers: QuestionPaper[] = [];
                if (Array.isArray(qpResponse.data)) {
                     qpResponse.data.forEach((group: any) => {
                        if (group.question_papers && Array.isArray(group.question_papers)) {
                            allPapers.push(...group.question_papers);
                        }
                     });
                }

                console.log(`    Found ${allPapers.length} question papers.`);
                
                // Save Course Index
                const courseDir = path.join(examDir, course.course_name);
                await saveJson(path.join(courseDir, 'index.json'), allPapers);

                // 3. Get Questions for each paper
                for (const paper of allPapers) {
                    // RESUME CAPABILITY: Skip if file already exists
                    const filePath = path.join(courseDir, `${paper.uuid}.json`);
                    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
                        // console.log(`      Skipping (Exists): ${paper.question_paper_name}`);
                        continue;
                    }

                    console.log(`      Fetching Paper: ${paper.question_paper_name} (${paper.uuid})`);
                    
                    const paperUrl = `${BASE_URL}/question-paper/practise/${course.id}/${paper.uuid}`;
                    
                    try {
                        await rateLimiter.sleep();
                        
                        const paperResponse = await client.get(paperUrl, {
                            headers: {
                                'X-Inertia': 'true',
                                'X-Inertia-Version': pageData.version
                            }
                        });
                        
                        const paperPageData = paperResponse.data as InertiaPage;
                        
                        if (paperPageData.props.question_paper) {
                             await saveJson(filePath, paperPageData.props.question_paper);
                             rateLimiter.recordSuccess();
                        } else {
                            console.error('      Failed to get questions');
                        }
                    } catch (e: any) {
                        if (rateLimiter.isRateLimitError(e)) {
                            rateLimiter.recordError(e);
                        }
                        console.error(`      Error fetching paper: ${e.message}`);
                    }

                    requestCount++;
                    if (requestCount % 100 === 0) {
                        console.log(`      [Status] Current delay: ${rateLimiter.getCurrentDelay()}, Papers: ${requestCount}`);
                    }
                }
            }

        } catch (error: any) {
            if (rateLimiter.isRateLimitError(error)) {
                rateLimiter.recordError(error);
                console.error(`Rate limit hit on ${examTarget.name}. Backing off...`);
                await rateLimiter.sleep();
            } else {
                console.error(`Error scraping ${examTarget.name}:`, error.message);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                }
            }
        }
        
        await rateLimiter.sleep();
    }
    console.log('\nScrape complete!');
}
