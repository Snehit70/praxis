import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const TOOL_ROOT = path.resolve(import.meta.dir, '..');
const PROJECT_ROOT = path.resolve(TOOL_ROOT, '..', '..');
const CDN_BASE = process.env.IMAGE_CDN_BASE ?? 'https://saram.blr1.cdn.digitaloceanspaces.com';
const IMAGE_DIR = process.env.IMAGE_OUTPUT_DIR
    ? path.resolve(process.env.IMAGE_OUTPUT_DIR)
    : path.join(PROJECT_ROOT, 'images-new');
const EXISTING_IMAGE_DIR = process.env.IMAGE_EXISTING_DIR
    ? path.resolve(process.env.IMAGE_EXISTING_DIR)
    : path.join(PROJECT_ROOT, 'images');
const USE_EXISTING_IMAGE_CACHE = process.env.IMAGE_USE_EXISTING_CACHE !== '0';
const IMAGE_URLS_FILE = process.env.IMAGE_URLS_FILE
    ? path.resolve(process.env.IMAGE_URLS_FILE)
    : path.join(PROJECT_ROOT, 'data-new-image-urls.json');
const SUMMARY_FILE = path.join(IMAGE_DIR, 'image-download-summary.json');
const STOP_FILE = path.join(TOOL_ROOT, '.stop');
const CONCURRENCY = Number.parseInt(process.env.IMAGE_DOWNLOAD_CONCURRENCY ?? '12', 10);
const REQUEST_DELAY_MS = Number.parseInt(process.env.IMAGE_DOWNLOAD_DELAY_MS ?? '0', 10);
const PROGRESS_EVERY = Number.parseInt(process.env.IMAGE_PROGRESS_EVERY ?? '500', 10);

interface ImageStats {
    total: number;
    downloaded: number;
    copiedFromExisting: number;
    skipped: number;
    failed: number;
    startTime: number;
    failures: Array<{ type: 'question' | 'option'; filename: string; url: string }>;
}

interface ImageTask {
    type: 'question' | 'option';
    filename: string;
    url: string;
    savePath: string;
}

async function sleep(ms: number) {
    if (ms <= 0) {
        return;
    }
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url: string, savePath: string): Promise<boolean> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000
        });

        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const tempPath = `${savePath}.part-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tempPath, response.data);
        fs.renameSync(tempPath, savePath);
        return true;
    } catch (error: any) {
        console.error(`   Failed: ${path.basename(savePath)} (${error.response?.status || error.message})`);
        return false;
    }
}

function copyExistingImage(type: 'question' | 'option', filename: string, savePath: string): boolean {
    if (!USE_EXISTING_IMAGE_CACHE) {
        return false;
    }

    const folder = type === 'question' ? 'question_images' : 'option_images';
    const existingPath = path.join(EXISTING_IMAGE_DIR, folder, filename);
    if (!fs.existsSync(existingPath) || fs.statSync(existingPath).size === 0) {
        return false;
    }

    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Never overwrite images-new; caller checks destination first.
    fs.copyFileSync(existingPath, savePath);
    return true;
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function printProgress(stats: ImageStats) {
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const checked = stats.downloaded + stats.copiedFromExisting + stats.skipped + stats.failed;
    const completeWithoutFailures = stats.downloaded + stats.copiedFromExisting + stats.skipped;
    const rate = checked / elapsed;
    const remaining = stats.total - checked;
    const eta = rate > 0 ? remaining / rate : 0;
    const completionPercent = (checked / stats.total) * 100;

    console.log(`\n📊 Progress:`);
    console.log(`   Total checked: ${checked}/${stats.total} (${completionPercent.toFixed(1)}% complete)`);
    console.log(`   Successful/available: ${completeWithoutFailures}/${stats.total}`);
    console.log(`   - Downloaded this session: ${stats.downloaded}`);
    console.log(`   - Copied from existing cache: ${stats.copiedFromExisting}`);
    console.log(`   - Skipped (already exist): ${stats.skipped}`);
    console.log(`   - Failed: ${stats.failed}`);
    console.log(`   Speed: ${rate.toFixed(1)} checked/sec`);
    console.log(`   Elapsed: ${formatTime(elapsed)}`);
    console.log(`   ETA: ${formatTime(eta)}`);
}

function makeTasks(imageData: { questionImages: string[]; optionImages: string[] }): ImageTask[] {
    return [
        ...imageData.questionImages.map((filename) => ({
            type: 'question' as const,
            filename,
            url: `${CDN_BASE}/question_images/${filename}`,
            savePath: path.join(IMAGE_DIR, 'question_images', filename),
        })),
        ...imageData.optionImages.map((imagePath) => {
            const filename = imagePath.replace('app/option_images/', '');
            return {
                type: 'option' as const,
                filename,
                url: `${CDN_BASE}/option_images/${filename}`,
                savePath: path.join(IMAGE_DIR, 'option_images', filename),
            };
        }),
    ];
}

async function runWorker(workerId: number, tasks: ImageTask[], cursor: { next: number }, stats: ImageStats) {
    while (true) {
        if (fs.existsSync(STOP_FILE)) {
            return;
        }

        const taskIndex = cursor.next;
        cursor.next += 1;
        const task = tasks[taskIndex];
        if (!task) {
            return;
        }

        if (fs.existsSync(task.savePath) && fs.statSync(task.savePath).size > 0) {
            stats.skipped += 1;
        } else if (copyExistingImage(task.type, task.filename, task.savePath)) {
            stats.copiedFromExisting += 1;
        } else {
            const success = await downloadImage(task.url, task.savePath);
            if (success) {
                stats.downloaded += 1;
            } else {
                stats.failed += 1;
                stats.failures.push({ type: task.type, filename: task.filename, url: task.url });
            }
            await sleep(REQUEST_DELAY_MS);
        }

        const completed = stats.downloaded + stats.copiedFromExisting + stats.skipped + stats.failed;
        if (completed > 0 && completed % PROGRESS_EVERY === 0) {
            console.log(`   Worker ${workerId} reached ${task.filename}`);
            printProgress(stats);
        }
    }
}

async function downloadImages() {
    console.log('🖼️  Image Downloader\n');
    console.log('=' .repeat(60));

    if (!fs.existsSync(IMAGE_URLS_FILE)) {
        console.error(`❌ Image manifest not found: ${IMAGE_URLS_FILE}`);
        console.error('   Run `bun run extract-images` first.');
        return;
    }

    const imageData = JSON.parse(fs.readFileSync(IMAGE_URLS_FILE, 'utf-8'));

    const stats: ImageStats = {
        total: imageData.questionImages.length + imageData.optionImages.length,
        downloaded: 0,
        copiedFromExisting: 0,
        skipped: 0,
        failed: 0,
        startTime: Date.now(),
        failures: []
    };

    console.log(`\n📦 Total images to download: ${stats.total}`);
    console.log(`   - Question images: ${imageData.questionImages.length}`);
    console.log(`   - Option images: ${imageData.optionImages.length}`);
    console.log(`   - Output: ${IMAGE_DIR}`);
    console.log(`   - Existing cache: ${USE_EXISTING_IMAGE_CACHE ? EXISTING_IMAGE_DIR : 'disabled'}`);
    console.log('');

    console.log(`   - Concurrency: ${CONCURRENCY}`);
    console.log(`   - Per-download delay: ${REQUEST_DELAY_MS}ms`);
    console.log('');

    const tasks = makeTasks(imageData);
    const cursor = { next: 0 };
    const workerCount = Math.max(1, Math.min(CONCURRENCY, tasks.length));
    console.log(`📥 Processing images with ${workerCount} workers...\n`);

    await Promise.all(
        Array.from({ length: workerCount }, (_, index) => runWorker(index + 1, tasks, cursor, stats)),
    );

    if (fs.existsSync(STOP_FILE)) {
        console.log('\n⏸️  Stop signal detected. Exiting gracefully...');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Download Complete!\n');
    printProgress(stats);

    console.log(`\n💾 Images saved to: ${IMAGE_DIR}`);
    console.log(`   - Question images: ${IMAGE_DIR}/question_images/`);
    console.log(`   - Option images: ${IMAGE_DIR}/option_images/`);

    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify({
        finishedAt: new Date().toISOString(),
        imageDir: IMAGE_DIR,
        existingImageDir: EXISTING_IMAGE_DIR,
        useExistingImageCache: USE_EXISTING_IMAGE_CACHE,
        total: stats.total,
        downloaded: stats.downloaded,
        copiedFromExisting: stats.copiedFromExisting,
        skipped: stats.skipped,
        failed: stats.failed,
        failures: stats.failures,
    }, null, 2));
    console.log(`   - Summary: ${SUMMARY_FILE}`);
}

downloadImages().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
