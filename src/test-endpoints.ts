import { client } from './client';

const BASE_URL = 'https://quizpractice.space';

interface TestResult {
    endpoint: string;
    status: 'success' | 'failed' | 'not_found';
    statusCode?: number;
    data?: any;
    error?: string;
}

async function testEndpoint(url: string, description: string): Promise<TestResult> {
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`   URL: ${url}`);
    
    try {
        const response = await client.get(url);
        console.log(`   ✅ Success (${response.status})`);
        
        return {
            endpoint: url,
            status: 'success',
            statusCode: response.status,
            data: typeof response.data === 'string' ? 
                  response.data.substring(0, 200) + '...' : 
                  response.data
        };
    } catch (error: any) {
        const statusCode = error.response?.status;
        
        if (statusCode === 404) {
            console.log(`   ❌ Not Found (404)`);
            return {
                endpoint: url,
                status: 'not_found',
                statusCode: 404
            };
        } else {
            console.log(`   ❌ Failed (${statusCode || 'unknown'}): ${error.message}`);
            return {
                endpoint: url,
                status: 'failed',
                statusCode,
                error: error.message
            };
        }
    }
}

async function main() {
    console.log('🚀 Testing Additional Endpoints\n');
    console.log('=' .repeat(60));
    
    const results: TestResult[] = [];
    
    results.push(await testEndpoint(
        `${BASE_URL}/app/question_images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png`,
        'Question Image (direct path)'
    ));
    
    results.push(await testEndpoint(
        `${BASE_URL}/app/option_images/LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png`,
        'Option Image (direct path)'
    ));
    
    results.push(await testEndpoint(
        `${BASE_URL}/api/question/95816/solutions`,
        'Solutions Endpoint (by ID)'
    ));
    
    results.push(await testEndpoint(
        `${BASE_URL}/api/question/0fb9e05b-2307-4dee-abe4-b7eecbbf1902/solutions`,
        'Solutions Endpoint (by UUID)'
    ));
    
    results.push(await testEndpoint(
        `${BASE_URL}/api/question/0fb9e05b-2307-4dee-abe4-b7eecbbf1902`,
        'Individual Question Endpoint'
    ));
    
    results.push(await testEndpoint(
        `${BASE_URL}/api/question/95816/comments`,
        'Comments Endpoint'
    ));
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:\n');
    
    const successful = results.filter(r => r.status === 'success').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Not Found: ${notFound}`);
    console.log(`   ⚠️  Failed: ${failed}`);
    
    console.log('\n📝 Detailed Results:\n');
    results.forEach((result, i) => {
        console.log(`${i + 1}. ${result.endpoint}`);
        console.log(`   Status: ${result.status} (${result.statusCode || 'N/A'})`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        console.log('');
    });
    
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
        path.join(process.cwd(), 'endpoint-test-results.json'),
        JSON.stringify(results, null, 2)
    );
    
    console.log('💾 Results saved to: endpoint-test-results.json');
}

main().catch(console.error);
