import { client } from './client';
import fs from 'fs';

const BASE_URL = 'https://quizpractice.space';

async function testExactJsonPatterns() {
    console.log('🔍 Testing EXACT patterns from JSON data\n');
    console.log('=' .repeat(60));
    
    const imageData = JSON.parse(fs.readFileSync('image-urls.json', 'utf-8'));
    
    const testCases = [
        {
            name: 'Question Image (exact JSON pattern)',
            url: `${BASE_URL}/question_images/${imageData.questionImages[0]}`,
            saveAs: 'test-question-exact.png'
        },
        {
            name: 'Option Image (exact JSON pattern)',
            url: `${BASE_URL}/${imageData.optionImages[0]}`,
            saveAs: 'test-option-exact.png'
        }
    ];
    
    for (const test of testCases) {
        console.log(`\n📍 Testing: ${test.name}`);
        console.log(`   URL: ${test.url}`);
        
        try {
            const response = await client.get(test.url, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            console.log(`   ✅ SUCCESS!`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            console.log(`   Size: ${response.data.length} bytes`);
            
            fs.writeFileSync(test.saveAs, response.data);
            console.log(`   💾 Saved: ${test.saveAs}`);
            
            return { success: true, pattern: test.url };
            
        } catch (error: any) {
            console.log(`   ❌ FAILED: ${error.response?.status || error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n❌ Both patterns failed.');
    console.log('📝 Browser investigation is required.');
    
    return { success: false };
}

testExactJsonPatterns().catch(console.error);
