## QuizPractice.space - Endpoint Discovery & Data Analysis

### ✅ **Confirmed Endpoints (Currently Scraping)**

1. **GET `/exam/{exam_uuid}`**
   - Returns: Exam metadata + full course list (95 courses)
   - Data: Course IDs, names, codes, UUIDs, program_id
   - Auth: None required

2. **POST `/api/get-questions-paper-by-exam`**
   - Payload: `{ course_id, year, exam_id }`
   - Returns: Grouped question papers by date
   - Data: Paper metadata (name, description, year, UUID, is_new flag)
   - Auth: CSRF token required

3. **GET `/question-paper/practise/{course_id}/{paper_uuid}`**
   - Returns: Complete question paper with all questions
   - Data: 
     - Questions (text, images, type, marks)
     - Options (text, images, is_correct flag)
     - Course info
     - Exam info
     - Metadata (solutions_count, comments_count)
   - Auth: None required (public practice mode)

---

### 🔎 **Potential Additional Endpoints (Not Yet Explored)**

#### **Question-Level Endpoints**
```
GET /api/question/{question_uuid}
GET /api/question/{question_id}/solutions
GET /api/question/{question_id}/comments
POST /api/question/{question_id}/report
```

#### **Course-Level Endpoints**
```
GET /api/course/{course_uuid}
GET /api/course/{course_id}/stats
GET /api/course/{course_id}/papers
```

#### **User/Score Endpoints** (Likely Auth-Protected)
```
POST /api/submit-answer
POST /api/submit-paper
GET /api/user/scores
GET /api/user/history
GET /api/leaderboard
```

#### **Search/Filter Endpoints**
```
POST /api/search/questions
GET /api/filter/papers?course=X&year=Y
```

---

### 📦 **Data Fields We're Capturing**

#### **Question Paper Level**
- `id`, `uuid`, `group_id`, `exam_id`
- `question_paper_name`, `question_paper_description`
- `year`, `is_new`, `duration`, `total_score`
- `created_at`, `updated_at`

#### **Question Level**
- `id`, `uuid`, `question_number`
- `question_text_1` through `question_text_5` (HTML)
- `question_image_1` through `question_image_10` (URLs)
- `question_type` (MCQ, etc.)
- `total_mark`, `have_answers`
- `solutions_count`, `comments_count`
- `hash` (unique identifier)
- `parent_question_id` (for multi-part questions)

#### **Option Level**
- `id`, `option_number`
- `option_text`, `option_image`
- `is_correct` (1 = correct, 0 = wrong)
- `score`

#### **Course Level**
- `id`, `uuid`, `course_name`, `course_code`
- `program_id` (1 = BS Data Science/CS, 2 = BS Electronics)
- `label`

---

### 🎯 **What We're NOT Getting (But Might Exist)**

1. **Solutions/Explanations**
   - Field exists: `solutions_count: 0`
   - Likely endpoint: `/api/question/{id}/solutions`
   - Status: Not publicly available or not yet added

2. **Comments/Discussions**
   - Field exists: `comments_count: 0`
   - Likely endpoint: `/api/question/{id}/comments`
   - Status: Feature might not be active

3. **Question Images**
   - Many questions have `question_image_1` through `question_image_10` fields
   - Most are `null` in current data
   - Some might have actual image URLs (need to check)

4. **Option Images**
   - Field exists: `option_image`, `option_image_url`
   - Mostly empty strings in current data

5. **User Scores/Analytics**
   - Requires authentication
   - Not accessible in public practice mode

6. **Difficulty Ratings**
   - Not present in current data
   - Might be calculated server-side

---

### 🔬 **Next Steps for Discovery**

1. **Check for Image URLs**
   - Scan all downloaded JSONs for non-null image fields
   - Download images if they exist

2. **Test Individual Question Endpoint**
   - Try: `GET /api/question/{question_uuid}`
   - See if it returns additional data

3. **Explore Solutions Endpoint**
   - Try: `GET /api/question/{question_id}/solutions`
   - Check if solutions are available

4. **Check for Other Exam Types**
   - Current: Quiz 1, Quiz 2, End Term, OPPE
   - Possible: Mid-term, Practice tests, Mock exams

5. **Analyze Program IDs**
   - program_id: 1 = BS Data Science/CS
   - program_id: 2 = BS Electronics
   - Check if there are other programs
