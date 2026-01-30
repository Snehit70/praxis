import fs from 'fs';
import path from 'path';
import axios from 'axios';

const CDN_BASE = 'https://saram.blr1.cdn.digitaloceanspaces.com';
const IMAGE_DIR = path.join(process.cwd(), 'images');
const IMAGE_URLS_FILE = path.join(process.cwd(), 'image-urls.json');

interface ImageStats {
    total: number;
    downloaded: number;
    skipped: number;
    failed: number;
    startTime: number;
}

async function sleep(min: number, max: number) {
    const ms = Math.floor(Math.random() * (max - min + 1) + min);
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
        
        fs.writeFileSync(savePath, response.data);
        return true;
    } catch (error: any) {
        console.error(`   ❌ Failed: ${error.response?.status || error.message}`);
        return false;
    }
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
    const rate = stats.downloaded / elapsed;
    const completed = stats.downloaded + stats.skipped;
    const remaining = stats.total - completed;
    const eta = remaining / rate;
    const completionPercent = (completed / stats.total) * 100;
    
    console.log(`\n📊 Progress:`);
    console.log(`   Total: ${completed}/${stats.total} (${completionPercent.toFixed(1)}% complete)`);
    console.log(`   - Downloaded this session: ${stats.downloaded}`);
    console.log(`   - Skipped (already exist): ${stats.skipped}`);
    console.log(`   - Failed: ${stats.failed}`);
    console.log(`   Speed: ${rate.toFixed(1)} images/sec`);
    console.log(`   Elapsed: ${formatTime(elapsed)}`);
    console.log(`   ETA: ${formatTime(eta)}`);
}

async function downloadImages() {
    console.log('🖼️  Image Downloader\n');
    console.log('=' .repeat(60));
    
    if (!fs.existsSync(IMAGE_URLS_FILE)) {
        console.error('❌ image-urls.json not found. Run extract-images.ts first.');
        return;
    }
    
    const imageData = JSON.parse(fs.readFileSync(IMAGE_URLS_FILE, 'utf-8'));
    
    const stats: ImageStats = {
        total: imageData.questionImages.length + imageData.optionImages.length,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        startTime: Date.now()
    };
    
    console.log(`\n📦 Total images to download: ${stats.total}`);
    console.log(`   - Question images: ${imageData.questionImages.length}`);
    console.log(`   - Option images: ${imageData.optionImages.length}`);
    console.log('');
    
    let requestCount = 0;
    
    console.log('📥 Downloading Question Images...\n');
    
    for (const filename of imageData.questionImages) {
        const url = `${CDN_BASE}/question_images/${filename}`;
        const savePath = path.join(IMAGE_DIR, 'question_images', filename);
        
        if (fs.existsSync(savePath) && fs.statSync(savePath).size > 0) {
            stats.skipped++;
            continue;
        }
        
        console.log(`   Downloading: ${filename}`);
        
        const success = await downloadImage(url, savePath);
        if (success) {
            stats.downloaded++;
        } else {
            stats.failed++;
        }
        
        requestCount++;
        
        if (requestCount % 100 === 0) {
            printProgress(stats);
        }
        
        // CDN-optimized delay (100-200ms instead of 1-2s)
        await sleep(100, 200);
        
        if (fs.existsSync('.stop')) {
            console.log('\n⏸️  Stop signal detected. Exiting gracefully...');
            break;
        }
    }
    
    console.log('\n📥 Downloading Option Images...\n');
    
    for (const imagePath of imageData.optionImages) {
        const filename = imagePath.replace('app/option_images/', '');
        const url = `${CDN_BASE}/option_images/${filename}`;
        const savePath = path.join(IMAGE_DIR, 'option_images', filename);
        
        if (fs.existsSync(savePath) && fs.statSync(savePath).size > 0) {
            stats.skipped++;
            continue;
        }
        
        console.log(`   Downloading: ${filename}`);
        
        const success = await downloadImage(url, savePath);
        if (success) {
            stats.downloaded++;
        } else {
            stats.failed++;
        }
        
        requestCount++;
        
        if (requestCount % 100 === 0) {
            printProgress(stats);
        }
        
        // CDN-optimized delay (100-200ms instead of 1-2s)
        await sleep(100, 200);
        
        if (fs.existsSync('.stop')) {
            console.log('\n⏸️  Stop signal detected. Exiting gracefully...');
            break;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Download Complete!\n');
    printProgress(stats);
    
    console.log(`\n💾 Images saved to: ${IMAGE_DIR}`);
    console.log(`   - Question images: ${IMAGE_DIR}/question_images/`);
    console.log(`   - Option images: ${IMAGE_DIR}/option_images/`);
}

downloadImages().catch(console.error);
