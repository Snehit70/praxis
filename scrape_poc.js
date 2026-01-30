const fs = require('fs');

async function main() {
    const cookiesRaw = fs.readFileSync('/tmp/cookies.txt', 'utf8');
    
    // Extract XSRF-TOKEN
    const match = cookiesRaw.match(/XSRF-TOKEN\s+(.+)/);
    if (!match) {
        console.error("XSRF-TOKEN not found in cookies");
        return;
    }
    const xsrfEncoded = match[1];
    const xsrfToken = decodeURIComponent(xsrfEncoded);
    
    // Extract Session (need all cookies for the header)
    const cookieHeader = cookiesRaw.split('\n')
        .filter(l => l && !l.startsWith('#'))
        .map(l => {
            const parts = l.split('\t');
            return `${parts[5]}=${parts[6]}`;
        })
        .join('; ');

    console.log("XSRF Token:", xsrfToken.substring(0, 20) + "...");

    const payload = {
        course_id: 1,
        year: "all",
        exam_id: "eyJpdiI6ImZ5bU56bndZRU15aDBZcDR2YjJoUmc9PSIsInZhbHVlIjoiS0dMc3RGVHNvbU9ZRGd2anNtWWxRZz09IiwibWFjIjoiYWQzOGFkNzA0MTNkYzYyODM2MjgxNzExOTVhYjA1NDZkMDY4NWFmMzc3NmFlZjVhN2RlZjdjNGNjYWQ4YWY5NyIsInRhZyI6IiJ9"
    };

    try {
        const response = await fetch("https://quizpractice.space/api/get-questions-paper-by-exam", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": xsrfToken,
                "Cookie": cookieHeader,
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://quizpractice.space/exam/9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Request failed:", response.status, response.statusText);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log("Success! Found", data.length, "question papers.");
        console.log(JSON.stringify(data.slice(0, 2), null, 2));
        
        // Save to file for inspection
        fs.writeFileSync('questions_sample.json', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
