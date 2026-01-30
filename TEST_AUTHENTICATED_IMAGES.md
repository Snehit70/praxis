# Testing Authenticated Image Access

Since all direct image URLs returned 404, the next step is to test if images require authentication (session cookies).

## Quick Test Script

Create `src/test-auth-images.ts`:

```typescript
import { client } from './client';
import fs from 'fs';

const BASE_URL = 'https://quizpractice.space';

async function testAuthenticatedImage() {
    console.log('Testing authenticated image access...\n');
    
    // Load sample image URLs from extracted data
    const imageData = JSON.parse(fs.readFileSync('image-urls.json', 'utf-8'));
    
    // Test question image
    const questionImage = imageData.questionImages[0];
    console.log(`Testing question image: ${questionImage}`);
    
    try {
        const response = await client.get(`${BASE_URL}/app/question_images/${questionImage}`, {
            responseType: 'arraybuffer'
        });
        
        console.log('✅ SUCCESS! Image is accessible with authentication');
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Size: ${response.data.length} bytes`);
        
        // Save test image
        fs.writeFileSync('test-question-image.png', response.data);
        console.log('   Saved to: test-question-image.png');
        
    } catch (error: any) {
        console.log(`❌ FAILED: ${error.response?.status || error.message}`);
    }
    
    // Test option image
    const optionImage = imageData.optionImages[0];
    console.log(`\nTesting option image: ${optionImage}`);
    
    try {
        const response = await client.get(`${BASE_URL}/${optionImage}`, {
            responseType: 'arraybuffer'
        });
        
        console.log('✅ SUCCESS! Image is accessible with authentication');
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Size: ${response.data.length} bytes`);
        
        // Save test image
        fs.writeFileSync('test-option-image.png', response.data);
        console.log('   Saved to: test-option-image.png');
        
    } catch (error: any) {
        console.log(`❌ FAILED: ${error.response?.status || error.message}`);
    }
}

testAuthenticatedImage().catch(console.error);
```

## Run the Test

```bash
npx tsx src/test-auth-images.ts
```

## Expected Outcomes

### If Images ARE Accessible:
- Status: 200
- Content-Type: image/png
- Files saved: test-question-image.png, test-option-image.png
- **Next Step:** Build image downloader with authentication

### If Images Are NOT Accessible:
- Status: 404 or 403
- **Next Step:** Browser DevTools investigation required

## Alternative URL Patterns to Test

If the above fails, try these patterns:

```typescript
// Pattern 1: /storage prefix
`${BASE_URL}/storage/question_images/${questionImage}`
`${BASE_URL}/storage/${optionImage}`

// Pattern 2: Direct from storage/app/public
`${BASE_URL}/storage/app/public/question_images/${questionImage}`

// Pattern 3: Different base path
`${BASE_URL}/images/question_images/${questionImage}`
```

## Browser DevTools Method

If all automated tests fail:

1. Open https://quizpractice.space in browser
2. Navigate to a question paper with images
3. Right-click on an image → "Inspect"
4. Check the `src` attribute
5. Copy the full URL
6. Test that URL in the script

This will reveal the actual URL pattern used by the frontend.
