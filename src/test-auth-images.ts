import { client } from './client';
import fs from 'fs';

const BASE_URL = 'https://quizpractice.space';

async function testAuthenticatedImage() {
    console.log('🔐 Testing Authenticated Image Access\n');
    console.log('=' .repeat(60));
    
    const imageData = JSON.parse(fs.readFileSync('image-urls.json', 'utf-8'));
    
    const testPatterns = [
        {
            name: 'Question Image (direct)',
            url: `${BASE_URL}/app/question_images/${imageData.questionImages[0]}`,
            saveAs: 'test-question-direct.png'
        },
        {
            name: 'Question Image (/storage prefix)',
            url: `${BASE_URL}/storage/question_images/${imageData.questionImages[0]}`,
            saveAs: 'test-question-storage.png'
        },
        {
            name: 'Option Image (direct)',
            url: `${BASE_URL}/${imageData.optionImages[0]}`,
            saveAs: 'test-option-direct.png'
        },
        {
            name: 'Option Image (without app/ prefix)',
            url: `${BASE_URL}/option_images/${imageData.optionImages[0].replace('app/option_images/', '')}`,
            saveAs: 'test-option-no-prefix.png'
        },
        {
            name: 'Option Image (/storage prefix)',
            url: `${BASE_URL}/storage/${imageData.optionImages[0]}`,
            saveAs: 'test-option-storage.png'
        }
    ];
    
    const results = [];
    
    for (const pattern of testPatterns) {
        console.log(`\n🔍 Testing: ${pattern.name}`);
        console.log(`   URL: ${pattern.url}`);
        
        try {
            const response = await client.get(pattern.url, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            console.log(`   ✅ SUCCESS!`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            console.log(`   Size: ${response.data.length} bytes`);
            
            fs.writeFileSync(pattern.saveAs, response.data);
            console.log(`   💾 Saved: ${pattern.saveAs}`);
            
            results.push({
                pattern: pattern.name,
                url: pattern.url,
                status: 'success',
                statusCode: response.status,
                contentType: response.headers['content-type'],
                size: response.data.length
            });
            
        } catch (error: any) {
            const statusCode = error.response?.status || 'unknown';
            console.log(`   ❌ FAILED: ${statusCode}`);
            
            results.push({
                pattern: pattern.name,
                url: pattern.url,
                status: 'failed',
                statusCode,
                error: error.message
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Summary:\n');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\n✨ Working Patterns:\n');
        successful.forEach(r => {
            console.log(`   - ${r.pattern}`);
            console.log(`     ${r.url}`);
        });
        
        console.log('\n🎉 Images ARE accessible with authentication!');
        console.log('📝 Next step: Build image downloader');
    } else {
        console.log('\n❌ No patterns worked with authentication.');
        console.log('📝 Next step: Browser DevTools investigation required');
        console.log('   1. Open https://quizpractice.space in browser');
        console.log('   2. Navigate to a question paper with images');
        console.log('   3. Right-click image → Inspect → Check src attribute');
    }
    
    fs.writeFileSync('auth-image-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved to: auth-image-test-results.json');
}

testAuthenticatedImage().catch(console.error);
