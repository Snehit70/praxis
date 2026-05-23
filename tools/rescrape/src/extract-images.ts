import fs from 'node:fs';
import path from 'node:path';

const TOOL_ROOT = path.resolve(import.meta.dir, '..');
const PROJECT_ROOT = path.resolve(TOOL_ROOT, '..', '..');
const DATA_DIR = process.env.SCRAPER_OUTPUT_DIR
    ? path.resolve(process.env.SCRAPER_OUTPUT_DIR)
    : path.join(PROJECT_ROOT, 'data-new');
const OUTPUT_FILE = process.env.IMAGE_URLS_FILE
    ? path.resolve(process.env.IMAGE_URLS_FILE)
    : path.join(PROJECT_ROOT, 'data-new-image-urls.json');

interface ImageData {
    questionImages: Set<string>;
    optionImages: Set<string>;
    questionImagesByFile: Record<string, string[]>;
    optionImagesByFile: Record<string, string[]>;
}

function extractImagesFromFile(filePath: string, data: ImageData) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);

        const relativePath = path.relative(DATA_DIR, filePath);

        if (json.questions && Array.isArray(json.questions)) {
            const questionImagesInFile: string[] = [];

            json.questions.forEach((q: any) => {
                for (let i = 1; i <= 10; i++) {
                    const imageField = `question_image_${i}`;
                    if (q[imageField] && q[imageField] !== null) {
                        data.questionImages.add(q[imageField]);
                        questionImagesInFile.push(q[imageField]);
                    }
                }

                if (q.options && Array.isArray(q.options)) {
                    const optionImagesInFile: string[] = [];

                    q.options.forEach((opt: any) => {
                        if (opt.option_image_url && opt.option_image_url !== '') {
                            data.optionImages.add(opt.option_image_url);
                            optionImagesInFile.push(opt.option_image_url);
                        }
                    });

                    if (optionImagesInFile.length > 0) {
                        if (!data.optionImagesByFile[relativePath]) {
                            data.optionImagesByFile[relativePath] = [];
                        }
                        data.optionImagesByFile[relativePath].push(...optionImagesInFile);
                    }
                }
            });

            if (questionImagesInFile.length > 0) {
                data.questionImagesByFile[relativePath] = questionImagesInFile;
            }
        }
    } catch (e: any) {
        console.error(`Error processing ${filePath}: ${e.message}`);
    }
}

function walkDirectory(dir: string, data: ImageData) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkDirectory(fullPath, data);
        } else if (file.endsWith('.json') && file !== 'metadata.json' && file !== 'index.json') {
            extractImagesFromFile(fullPath, data);
        }
    }
}

async function main() {
    console.log('Extracting image URLs from scraped data...\n');

    const data: ImageData = {
        questionImages: new Set(),
        optionImages: new Set(),
        questionImagesByFile: {},
        optionImagesByFile: {}
    };

    walkDirectory(DATA_DIR, data);

    const output = {
        summary: {
            totalQuestionImages: data.questionImages.size,
            totalOptionImages: data.optionImages.size,
            filesWithQuestionImages: Object.keys(data.questionImagesByFile).length,
            filesWithOptionImages: Object.keys(data.optionImagesByFile).length
        },
        questionImages: Array.from(data.questionImages).sort(),
        optionImages: Array.from(data.optionImages).sort(),
        questionImagesByFile: data.questionImagesByFile,
        optionImagesByFile: data.optionImagesByFile
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log('✅ Extraction Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   - Question Images: ${output.summary.totalQuestionImages}`);
    console.log(`   - Option Images: ${output.summary.totalOptionImages}`);
    console.log(`   - Files with Question Images: ${output.summary.filesWithQuestionImages}`);
    console.log(`   - Files with Option Images: ${output.summary.filesWithOptionImages}`);
    console.log(`\n💾 Output saved to: ${OUTPUT_FILE}`);
}

main().catch(console.error);
