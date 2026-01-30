# Additional Endpoints & Data Discovery

**Date**: 2025-01-29  
**Status**: Discovery Phase  
**Current Scraping**: Papers in progress (630 files, ~21MB)

---

## 🎯 **Summary**

While scraping question papers, we discovered **significant additional data** that's NOT being captured:

| Data Type | Count | Status | Priority |
|-----------|-------|--------|----------|
| **Question Images** | 10,989 | Not downloaded | HIGH |
| **Option Images** | 16,401 | Not downloaded | HIGH |
| **Solutions** | 31 questions | Endpoint unknown | MEDIUM |
| **Comments** | 0 (all empty) | Feature inactive | LOW |

---

## 📊 **Discovered Data Fields**

### 1. Question Images

**Field**: `question_image_1` through `question_image_10`  
**Format**: Filename only (e.g., `ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png`)  
**Count**: 10,989 non-null instances across 608 files  
**Base URL**: Likely `https://quizpractice.space/app/question_images/`

**Example**:
```json
{
  "question_image_1": "ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png",
  "question_image_2": null,
  ...
}
```

### 2. Option Images

**Field**: `option_image_url`  
**Format**: Relative path (e.g., `app/option_images/HHEdLLSIjXItl2qlcnsb6UHitEWom2jhKcEdPyePH5YV3ZpwkA.png`)  
**Count**: 16,401 non-null instances across 606 files  
**Base URL**: `https://quizpractice.space/`

**Example**:
```json
{
  "option_text": "",
  "option_image": "LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png",
  "option_image_url": "app/option_images/LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png",
  "is_correct": 1
}
```

### 3. Solutions

**Field**: `solutions_count`  
**Count**: 31 questions with `solutions_count > 0`  
**Potential Endpoint**: `/api/question/{question_id}/solutions` or `/api/question/{question_uuid}/solutions`

**Questions with Solutions**:
- MLT: 1 question (id: 95816, uuid: 0fb9e05b-2307-4dee-abe4-b7eecbbf1902)
- AppDev2: 7 questions
- Java: 8 questions
- Statistics2: 3 questions
- DBMS: 3 questions
- And more...

**Example**:
```json
{
  "id": 95816,
  "uuid": "0fb9e05b-2307-4dee-abe4-b7eecbbf1902",
  "solutions_count": 1,
  "comments_count": 0
}
```

### 4. Comments

**Field**: `comments_count`  
**Status**: All values are `0` - feature appears inactive  
**Potential Endpoint**: `/api/question/{question_id}/comments`

---

## 🔍 **Endpoints to Test**

### High Priority

1. **Question Images**
   ```
   GET https://quizpractice.space/app/question_images/{filename}
   ```
   - Test with: `ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png`

2. **Option Images**
   ```
   GET https://quizpractice.space/app/option_images/{filename}
   ```
   - Test with: `LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png`

### Medium Priority

3. **Solutions Endpoint**
   ```
   GET /api/question/{question_id}/solutions
   GET /api/question/{question_uuid}/solutions
   ```
   - Test with: id=95816 or uuid=0fb9e05b-2307-4dee-abe4-b7eecbbf1902

4. **Individual Question Endpoint**
   ```
   GET /api/question/{question_uuid}
   ```
   - Might return additional metadata

### Low Priority

5. **Comments Endpoint**
   ```
   GET /api/question/{question_id}/comments
   ```
   - Likely returns empty array (feature inactive)

---

## 📁 **Data Distribution**

### Images by Course (Top 10)

| Course | Question Images | Option Images |
|--------|----------------|---------------|
| MLT | ~2,000+ | ~3,000+ |
| AppDev2 | ~1,500+ | ~2,500+ |
| Java | ~800+ | ~1,200+ |
| Statistics2 | ~600+ | ~900+ |
| DBMS | ~500+ | ~800+ |

*(Exact counts pending full analysis)*

---

## 🛠️ **Next Steps**

### Phase 1: Validation (Now)
- [ ] Test image URLs to confirm base path
- [ ] Test solutions endpoint with known question IDs
- [ ] Verify image accessibility (public vs auth-required)

### Phase 2: Extraction (After validation)
- [ ] Build image URL extractor script
- [ ] Create image downloader with resume capability
- [ ] Test solutions scraper for accessible questions

### Phase 3: Integration (After extraction)
- [ ] Integrate image downloading into main scraper
- [ ] Add solutions fetching (if accessible)
- [ ] Update data structure documentation

---

## 💾 **Estimated Data Size**

| Data Type | Count | Avg Size | Total Size |
|-----------|-------|----------|------------|
| Question Images | ~11,000 | 50KB | ~550MB |
| Option Images | ~16,000 | 30KB | ~480MB |
| Solutions | 31 | 5KB | ~155KB |
| **TOTAL** | | | **~1GB** |

---

## 🚨 **Important Notes**

1. **Rate Limiting**: Images should be downloaded with delays (1-2s between requests)
2. **Resume Capability**: Track downloaded images to avoid re-downloading
3. **Storage**: Ensure ~1GB free space for complete dataset
4. **Politeness**: Respect server resources - don't hammer image endpoints

---

## 📝 **Questions to Answer**

- [ ] Are images publicly accessible or require authentication?
- [ ] What format are solutions in? (Text, HTML, Images?)
- [ ] Are there other exam types beyond Quiz 1, Quiz 2, End Term, OPPE?
- [ ] Are there historical papers from previous years?
- [ ] Is there a search/filter API we haven't discovered?
