# 📸 Images in Scraped Data - Explained

## What We Have vs What We Need

### ✅ What We HAVE (Already Scraped)

**Image References** - The JSON files contain:

```json
{
  "question_image_1": "ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png",
  "question_image_url": ["/question_images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png"]
}
```

```json
{
  "option_image": "LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png",
  "option_image_url": "app/option_images/LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png"
}
```

**These are just filenames/paths, NOT the actual images.**

### ❌ What We DON'T Have (Need to Download)

**The actual image files** - The PNG/JPG files themselves are stored on the server.

**File size proves this:**
- JSON file with 17 questions + images: **58KB**
- If images were embedded as base64: Would be **500KB-1MB+**

---

## 🔍 The Problem

We have **26,652 image references** but don't know the correct URL to download them.

**Tried patterns (all failed):**
```
❌ https://quizpractice.space/app/question_images/{filename}
❌ https://quizpractice.space/storage/question_images/{filename}
❌ https://quizpractice.space/question_images/{filename}
❌ https://quizpractice.space/app/option_images/{filename}
❌ https://quizpractice.space/storage/app/option_images/{filename}
```

**Notice the `question_image_url` field shows:** `/question_images/...` (with leading slash)

This suggests the correct pattern might be:
```
https://quizpractice.space/question_images/{filename}
```

But we already tested that and it returned 404!

---

## 🎯 Why Browser Investigation is Critical

The frontend (Vue.js) successfully loads these images. We need to see:

1. **What URL does the browser actually use?**
2. **Are there any query parameters?** (e.g., `?token=...`)
3. **Are images loaded through JavaScript?** (dynamic URLs)
4. **Is there a CDN?** (different domain)

---

## 📋 Quick Browser Test

1. Open: https://quizpractice.space
2. Navigate to a paper with images (e.g., MLT papers)
3. Right-click on any image → "Inspect Element"
4. Look at the `<img>` tag's `src` attribute

**Example of what you might see:**
```html
<!-- Pattern 1: Direct path -->
<img src="/question_images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png">

<!-- Pattern 2: Full URL -->
<img src="https://quizpractice.space/storage/question_images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png">

<!-- Pattern 3: CDN -->
<img src="https://cdn.quizpractice.space/images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png">

<!-- Pattern 4: Signed URL -->
<img src="/question_images/ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png?signature=abc123">
```

**Copy the exact `src` value and tell me what it is.**

---

## 🚀 Once We Know the Pattern

I'll build an image downloader that:
- Uses the correct URL pattern
- Downloads all 26,652 images
- Has resume capability (skip existing)
- Respects rate limits (1-2s delays)
- Organizes by course/paper

**Estimated download time:** 10-15 hours (with polite delays)
**Estimated storage:** ~1GB

---

## 💡 Summary

**Question:** "Don't papers have images too?"

**Answer:** Papers have **image references** (filenames), but not the actual image data. We need to:
1. Find the correct URL pattern (browser investigation)
2. Download the 26,652 images separately
3. Store them alongside the JSON files

**Current status:** We have all the metadata, just need the correct download URL.
