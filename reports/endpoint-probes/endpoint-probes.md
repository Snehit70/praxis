# QuizPractice Endpoint Probe Results

Generated: 2026-05-06T16:23:31.305Z

## Sample IDs

| Exam          | Course              | Paper UUID   | Question ID | Question UUID                        | Type | Solutions | Comments |
| ------------- | ------------------- | ------------ | ----------- | ------------------------------------ | ---- | --------- | -------- |
| Quiz 1        | CT (1)              | 4b15c17c-372 | 123506      | f12e3656-c3c1-42c9-a9e2-b8203b0eddab | MCQ  | 0         | 0        |
| Quiz 2        | CT (1)              | e90571c9-daa | 123946      | 3e067b9a-8963-4019-8aa1-9b991872772a | MCQ  | 0         | 0        |
| End Term Quiz | English (35)        | 7dc70481-202 | 76945       | a09243c9-3869-4685-b62d-8495233c7c8e | MCQ  | 0         | 0        |
| OPPE          | Intro to python (2) | 66f4b08b-d72 | 68504       | b0fb52f9-fea6-4a94-ab3f-46eed064723b | OPPE | 0         | 0        |

## Probe Summary

| Label                        | Method | Path                                         | Status | Body         | Component/Keys            |
| ---------------------------- | ------ | -------------------------------------------- | ------ | ------------ | ------------------------- |
| Course API                   | GET    | /api/get_courses                             | 200    | string       |                           |
| Topics API                   | GET    | /api/topics                                  | 200    | array        |                           |
| AI solutions API             | GET    | /api/get_ai_solutions                        | 200    | string       |                           |
| Question repository page     | GET    | /questions/repository                        | 200    | html:inertia | Question/Repository       |
| Python practise page         | GET    | /python/practise                             | 200    | html:inertia | Python/Practise           |
| Quiz 1 view question         | GET    | /question-paper/view-question/123506         | 200    | html:inertia | Quizpractise/ViewQuestion |
| Quiz 1 solutions             | GET    | /questions/123506/solution                   | 401    | object       | message                   |
| Quiz 1 comments              | GET    | /questions/123506/comments                   | 401    | object       | message                   |
| Quiz 1 corrections           | GET    | /questions/123506/corrections                | 200    | array        |                           |
| Quiz 1 topic stats           | GET    | /api/questions/123506/topic-stats            | 500    | object       | message                   |
| Quiz 1 paper download        | HEAD   | /question-paper/download/1/4b15c17c-372      | 404    | string       |                           |
| Quiz 1 paper PDF             | HEAD   | /question-paper/download-pdf/1/4b15c17c-372  | 401    | string       |                           |
| Quiz 2 view question         | GET    | /question-paper/view-question/123946         | 200    | html:inertia | Quizpractise/ViewQuestion |
| Quiz 2 solutions             | GET    | /questions/123946/solution                   | 401    | object       | message                   |
| Quiz 2 comments              | GET    | /questions/123946/comments                   | 401    | object       | message                   |
| Quiz 2 corrections           | GET    | /questions/123946/corrections                | 200    | array        |                           |
| Quiz 2 topic stats           | GET    | /api/questions/123946/topic-stats            | 500    | object       | message                   |
| Quiz 2 paper download        | HEAD   | /question-paper/download/1/e90571c9-daa      | 404    | string       |                           |
| Quiz 2 paper PDF             | HEAD   | /question-paper/download-pdf/1/e90571c9-daa  | 401    | string       |                           |
| End Term Quiz view question  | GET    | /question-paper/view-question/76945          | 200    | html:inertia | Quizpractise/ViewQuestion |
| End Term Quiz solutions      | GET    | /questions/76945/solution                    | 401    | object       | message                   |
| End Term Quiz comments       | GET    | /questions/76945/comments                    | 401    | object       | message                   |
| End Term Quiz corrections    | GET    | /questions/76945/corrections                 | 200    | array        |                           |
| End Term Quiz topic stats    | GET    | /api/questions/76945/topic-stats             | 500    | object       | message                   |
| End Term Quiz paper download | HEAD   | /question-paper/download/35/7dc70481-202     | 404    | string       |                           |
| End Term Quiz paper PDF      | HEAD   | /question-paper/download-pdf/35/7dc70481-202 | 401    | string       |                           |
| OPPE view question           | GET    | /question-paper/view-question/68504          | 200    | html:inertia | Quizpractise/ViewQuestion |
| OPPE solutions               | GET    | /questions/68504/solution                    | 401    | object       | message                   |
| OPPE comments                | GET    | /questions/68504/comments                    | 401    | object       | message                   |
| OPPE corrections             | GET    | /questions/68504/corrections                 | 200    | array        |                           |
| OPPE topic stats             | GET    | /api/questions/68504/topic-stats             | 500    | object       | message                   |
| OPPE paper download          | HEAD   | /question-paper/download/2/66f4b08b-d72      | 404    | string       |                           |
| OPPE paper PDF               | HEAD   | /question-paper/download-pdf/2/66f4b08b-d72  | 401    | string       |                           |

## Notes

- `html:inertia` means the endpoint returned an Inertia page, not raw JSON.
- `401`, `403`, or redirects indicate auth/subscription protection.
- `404` on old guessed API paths should not be considered absence of data if Ziggy exposes a newer route.
- HEAD checks avoid downloading full papers/PDFs while confirming route existence.
