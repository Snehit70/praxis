# QuizPractice Website Discovery

Generated: 2026-05-06T16:16:22.385Z

## Home

| Metric                     | Value                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                     | 200                                                                                                                                                                                        |
| Title                      | QuizPractice | IITM BS Degree Question Papers                                                                                                                                              |
| Component                  | Home                                                                                                                                                                                       |
| Inertia version            | 723f57480ff87bc9a0caf00c2d9881f3                                                                                                                                                           |
| Home prop keys             | errors, auth, flash, banner, file_url, file_do_url, exam_date, feedbacks, courses, exams, online_users, subscription_config                                                                |
| Home exams                 | Quiz 1:9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa | Quiz 2:1948ee72-5c62-4816-97c8-7d662330a220 | End Term Quiz:7a6ff569-f50c-40e7-a08b-f5c334392600 | OPPE:4e5fffd3-41e9-4ec7-853c-8af983edb699 |
| Home courses prop count    | 3                                                                                                                                                                                          |
| Asset links                | 27                                                                                                                                                                                         |
| Ziggy routes               | 127                                                                                                                                                                                        |
| Interesting routes         | 93                                                                                                                                                                                         |
| JS assets scanned          | 71                                                                                                                                                                                         |
| Bundle endpoint candidates | 166                                                                                                                                                                                        |

## Ziggy Route Table

These are server-advertised route names and URI templates embedded in the current HTML. This is the most reliable endpoint discovery source.

| Name                                    | Methods   | URI                                          | Params         |
| --------------------------------------- | --------- | -------------------------------------------- | -------------- |
| admin.course-aliases.destroy            | DELETE    | admin/course-aliases/{courseAlias}           | courseAlias    |
| admin.course-aliases.index              | GET,HEAD  | admin/course-aliases                         |                |
| admin.course-aliases.merge              | POST      | admin/course-aliases/merge                   |                |
| admin.course-aliases.store              | POST      | admin/course-aliases                         |                |
| admin.exam.create                       | GET,HEAD  | admin/exam/create                            |                |
| admin.exam.destroy                      | DELETE    | admin/exam/{exam}                            | exam           |
| admin.exam.edit                         | GET,HEAD  | admin/exam/{exam}/edit                       | exam           |
| admin.exam.index                        | GET,HEAD  | admin/exam                                   |                |
| admin.exam.show                         | GET,HEAD  | admin/exam/{exam}                            | exam           |
| admin.exam.store                        | POST      | admin/exam                                   |                |
| admin.exam.update                       | PUT,PATCH | admin/exam/{exam}                            | exam           |
| admin.question-paper.create             | GET,HEAD  | admin/question-paper/create                  |                |
| admin.question-paper.destroy            | DELETE    | admin/question-paper/{question_paper}        | question_paper |
| admin.question-paper.edit               | GET,HEAD  | admin/question-paper/{question_paper}/edit   | question_paper |
| admin.question-paper.index              | GET,HEAD  | admin/question-paper                         |                |
| admin.question-paper.show               | GET,HEAD  | admin/question-paper/{question_paper}        | question_paper |
| admin.question-paper.store              | POST      | admin/question-paper                         |                |
| admin.question-paper.update             | PUT,PATCH | admin/question-paper/{question_paper}        | question_paper |
| admin.questions.create                  | GET,HEAD  | admin/questions/create                       |                |
| admin.questions.destroy                 | DELETE    | admin/questions/{question}                   | question       |
| admin.questions.edit                    | GET,HEAD  | admin/questions/{question}/edit              | question       |
| admin.questions.index                   | GET,HEAD  | admin/questions                              |                |
| admin.questions.show                    | GET,HEAD  | admin/questions/{question}                   | question       |
| admin.questions.store                   | POST      | admin/questions                              |                |
| admin.questions.update                  | PUT,PATCH | admin/questions/{question}                   | question       |
| admin.submissions.approve               | POST      | admin/submissions/{submission}/approve       | submission     |
| admin.submissions.index                 | GET,HEAD  | admin/submissions                            |                |
| admin.submissions.pdf                   | GET,HEAD  | admin/submissions/{submission}/pdf           | submission     |
| admin.submissions.reject                | POST      | admin/submissions/{submission}/reject        | submission     |
| admin.submissions.show                  | GET,HEAD  | admin/submissions/{submission}               | submission     |
| admin.subscriptions.check-pending       | POST      | admin/subscriptions/check-pending            |                |
| admin.subscriptions.config              | POST      | admin/subscriptions/config                   |                |
| admin.subscriptions.index               | GET,HEAD  | admin/subscriptions                          |                |
| api.                                    | GET,HEAD  | api/get_questions                            |                |
| api.event-log.store                     | POST      | api/event-log                                |                |
| api.generated::0BrTRGiEIirLYsyx         | GET,HEAD  | api/user                                     |                |
| api.generated::3joqlRNLHTY68Rgd         | POST      | api/save_solution                            |                |
| api.generated::5b64qmL4JmknvNBe         | POST      | api/webhook/telegram/correction              |                |
| api.generated::60c3w6Or2JvmnQig         | POST      | api/webhook/telegram/format-fix              |                |
| api.generated::7qFQ2BYnzcxdI4kH         | GET,HEAD  | api/get_courses                              |                |
| api.generated::gS1OzjcFr9lor2P1         | POST      | api/get_similar_questions                    |                |
| api.generated::JrZBc8IdOwrLTKUr         | POST      | api/webhook/buy-me-a-coffee                  |                |
| api.generated::PvEWH7dhcQpQQqPf         | GET,HEAD  | api/get_skip_ai_solutions/{id}               | id             |
| api.generated::RhySfKUqCJaCG82v         | GET,HEAD  | api/topics                                   |                |
| api.generated::t1FhIo1wZTddMZ7Z         | GET,HEAD  | api/get_ai_solutions                         |                |
| api.generated::ULMtxBNUK1iTWkma         | POST      | api/get-questions-paper-by-exam              |                |
| api.generated::Z4roaggSD0A5XnFe         | POST      | api/webhook/razorpay                         |                |
| api.question-paper.log_test             | POST      | api/question-paper/log_test                  |                |
| api.question.flag                       | POST      | api/question/flag                            |                |
| api.submissions.approve                 | GET,HEAD  | api/submissions/{submission}/approve         | submission     |
| api.topics.stats                        | GET,HEAD  | api/questions/{question}/topic-stats         | question       |
| documentation.solutionPostingConditions | GET,HEAD  | documentation/solution-posting-conditions    |                |
| exam.index                              | GET,HEAD  | exam                                         |                |
| exam.show                               | GET,HEAD  | exam/{exam}                                  | exam           |
| ignition.executeSolution                | POST      | _ignition/execute-solution                   |                |
| profile                                 | GET,HEAD  | profile                                      |                |
| public_profile                          | GET,HEAD  | u/{username}                                 | username       |
| python.practise                         | GET,HEAD  | python/practise                              |                |
| question-paper.download                 | GET,HEAD  | question-paper/download/{course_id}/{id}     | course_id,id   |
| question-paper.download-pdf             | GET,HEAD  | question-paper/download-pdf/{course_id}/{id} | course_id,id   |
| question-paper.practise                 | GET,HEAD  | question-paper/practise/{course_id}/{id}     | course_id,id   |
| question-paper.upload                   | GET,HEAD  | question-paper/upload                        |                |
| question-paper.upload-post              | POST      | question-paper/upload-post                   |                |
| question-paper.view-question            | GET,HEAD  | question-paper/view-question/{question}      | question       |
| questions.comments.destroy              | DELETE    | questions/comments/{comment}                 | comment        |
| questions.comments.fetch                | GET,HEAD  | questions/{question}/comments                | question       |
| questions.comments.index                | GET,HEAD  | questions/questions/{question}/discussion    | question       |
| questions.comments.store                | POST      | questions/comments                           |                |
| questions.comments.toggle-like          | POST      | questions/comments/{comment}/toggle-like     | comment        |
| questions.corrections.destroy           | DELETE    | questions/corrections/{correction}           | correction     |
| questions.corrections.index             | GET,HEAD  | questions/{question}/corrections             | question       |
| questions.corrections.store             | POST      | questions/{question}/corrections             | question       |
| questions.corrections.vote              | POST      | questions/corrections/{correction}/vote      | correction     |
| questions.format-fix.store              | POST      | questions/{question}/format-fix              | question       |
| questions.generate-ai-answer-stream     | POST      | questions/generate-ai-answer-stream          |                |
| questions.repository                    | GET,HEAD  | questions/repository                         |                |
| questions.search_repository             | POST      | questions/repository                         |                |
| questions.solution.destroy              | DELETE    | questions/{question}/solution                | question       |
| questions.solution.index                | GET,HEAD  | questions/{question}/solution                | question       |
| questions.solution.store                | POST      | questions/{question}/solution                | question       |
| questions.solution.update               | PUT       | questions/{question}/solution                | question       |
| solutions.downvote                      | POST      | solutions/{solution}/downvote                | solution       |
| solutions.upvote                        | POST      | solutions/{solution}/upvote                  | solution       |
| solutions.view_log                      | POST      | solutions/{solution}/view_log                | solution       |
| submissions.create                      | GET,HEAD  | submissions                                  |                |
| submissions.store                       | POST      | submissions                                  |                |
| subscription.check-status               | POST      | subscribe/check-status                       |                |
| subscription.index                      | GET,HEAD  | subscribe                                    |                |
| subscription.order                      | POST      | subscribe/order                              |                |
| subscription.verify                     | POST      | subscribe/verify                             |                |
| user.profile_picture                    | GET,HEAD  | user/profile_picture                         |                |
| user.show_profile_picture               | GET,HEAD  | user/show_profile_picture/{name}             | name           |
| user.toggle_profile_picture_visibility  | POST      | user/toggle-profile-picture-visibility       |                |

## Bundle Reverse Engineering

Candidate route/API strings found in current JS bundles. These are not all confirmed endpoints; treat them as leads.

| Candidate                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- |
| /api/get-questions-paper-by-exam                                                                                 |
| API                                                                                                              |
| APIFunction                                                                                                      |
| AvailableCoursesSection                                                                                          |
| COMMENT                                                                                                          |
| CapitalDifferentialD                                                                                             |
| Capitalize                                                                                                       |
| Comment                                                                                                          |
| CommentSection                                                                                                   |
| Comments                                                                                                         |
| CommentsRepository                                                                                               |
| Course                                                                                                           |
| Decapitalize                                                                                                     |
| Exam                                                                                                             |
| Example                                                                                                          |
| ExampleData                                                                                                      |
| Exams                                                                                                            |
| FileQuestionIcon                                                                                                 |
| FileRepository                                                                                                   |
| GeoResolution                                                                                                    |
| ImageResolution                                                                                                  |
| IncludeSingularSolutions                                                                                         |
| MB_ICONQUESTION                                                                                                  |
| ML_COMMENT                                                                                                       |
| MapIndexed                                                                                                       |
| MinkowskiQuestionMark                                                                                            |
| NewspaperIcon                                                                                                    |
| PaperWidth                                                                                                       |
| ParentQuestion                                                                                                   |
| ParetoPickandsDistribution                                                                                       |
| PractiseQuestionPaper                                                                                            |
| Question                                                                                                         |
| QuestionCorrectionModal                                                                                          |
| QuestionGenerator                                                                                                |
| QuestionInterface                                                                                                |
| QuestionObject                                                                                                   |
| QuestionPaperSummaryDialog                                                                                       |
| QuestionSelector                                                                                                 |
| Questions                                                                                                        |
| RemoteBatchSubmissionEnvironment                                                                                 |
| Repository                                                                                                       |
| ResourceSubmissionObject                                                                                         |
| RudinShapiro                                                                                                     |
| SINGLE_LINE_COMMENT                                                                                              |
| ShapiroWilkTest                                                                                                  |
| ShowQuestionPapers                                                                                               |
| Solution                                                                                                         |
| SolutionPostingConditions                                                                                        |
| Solutions                                                                                                        |
| Submissions                                                                                                      |
| Subscriptions                                                                                                    |
| SystemModelExamples                                                                                              |
| VerifySolutions                                                                                                  |
| ViewQuestion                                                                                                     |
| WaveletMapIndexed                                                                                                |
| WidgetToolbarRepository                                                                                          |
| ZapIcon                                                                                                          |
| _conversionApi                                                                                                   |
| admin.questions.index                                                                                            |
| admin.submissions.approve                                                                                        |
| admin.submissions.index                                                                                          |
| admin.submissions.pdf                                                                                            |
| admin.submissions.reject                                                                                         |
| admin.submissions.show                                                                                           |
| admin.subscriptions.check-pending                                                                                |
| admin.subscriptions.config                                                                                       |
| admin.subscriptions.index                                                                                        |
| advance-example                                                                                                  |
| analogReadResolution                                                                                             |
| analogWriteResolution                                                                                            |
| api.event-log.store                                                                                              |
| api.question-paper.log_test                                                                                      |
| attachtoform-missing-elementapi-interface                                                                        |
| attribute-comment                                                                                                |
| autocapitalize                                                                                                   |
| autopictureinpicture                                                                                             |
| capitalize                                                                                                       |
| cleanupComments                                                                                                  |
| comment                                                                                                          |
| commentAtEnd                                                                                                     |
| commentInput                                                                                                     |
| commentSection                                                                                                   |
| comments                                                                                                         |
| comments_page                                                                                                    |
| conversionApi                                                                                                    |
| course-name                                                                                                      |
| courses                                                                                                          |
| dataPipeline:transparentRendering                                                                                |
| disableMapIndicators                                                                                             |
| escaping                                                                                                         |
| exam.show                                                                                                        |
| exam_date                                                                                                        |
| exam_id                                                                                                          |
| exams                                                                                                            |
| filerepository-no-upload-adapter                                                                                 |
| filerepository-read-wrong-status                                                                                 |
| filerepository-upload-wrong-status                                                                               |
| getResolution                                                                                                    |
| https://quizpractice.space/question-paper/view-question/40335?solution=asfsd-sidfh-osdifj-sdf-iojsldf-1731586795 |
| image-resolution                                                                                                 |
| kbAddTopic                                                                                                       |
| kbHasTopic                                                                                                       |
| kbRemoveTopic                                                                                                    |
| kbv_autocapitalize_characters                                                                                    |
| kbv_autocapitalize_none                                                                                          |
| kbv_autocapitalize_sentences                                                                                     |
| kbv_autocapitalize_words                                                                                         |
| latex-example                                                                                                    |
| menuBar:comment                                                                                                  |
| menuBar:commentsArchive                                                                                          |
| paper-tape                                                                                                       |
| question                                                                                                         |
| question-id                                                                                                      |
| question-number                                                                                                  |
| question-paper.download-pdf                                                                                      |
| question-paper.practise                                                                                          |
| question-paper.view-question                                                                                     |
| questionMarks                                                                                                    |
| question_id                                                                                                      |
| question_papers                                                                                                  |
| question_text                                                                                                    |
| question_text_                                                                                                   |
| questions                                                                                                        |
| questions.comments.destroy                                                                                       |
| questions.comments.fetch                                                                                         |
| questions.comments.store                                                                                         |
| questions.comments.toggle-like                                                                                   |
| questions.corrections.destroy                                                                                    |
| questions.corrections.index                                                                                      |
| questions.corrections.store                                                                                      |
| questions.corrections.vote                                                                                       |
| questions.format-fix.store                                                                                       |
| questions.generate-ai-answer-stream                                                                              |
| questions.repository                                                                                             |
| questions.search_repository                                                                                      |
| questions.solution.destroy                                                                                       |
| questions.solution.store                                                                                         |
| questions.solution.update                                                                                        |
| resolution                                                                                                       |
| rollback_api_server                                                                                              |
| scheduler_resolution_get                                                                                         |
| scheduler_resolution_set                                                                                         |
| show_comment_section                                                                                             |
| show_question                                                                                                    |
| show_question_async                                                                                              |
| show_question_paper_summary                                                                                      |
| skipComments                                                                                                     |
| solution                                                                                                         |
| solutions                                                                                                        |
| solutions.downvote                                                                                               |
| solutions.upvote                                                                                                 |
| solutions_page                                                                                                   |
| submissions.create                                                                                               |
| submissions.store                                                                                                |
| subscription                                                                                                     |
| subscription.check-status                                                                                        |
| subscription.index                                                                                               |
| subscription.order                                                                                               |
| subscription.verify                                                                                              |
| subscriptions                                                                                                    |
| wallpaper_config                                                                                                 |
| wallpaper_set_config                                                                                             |
| wallpaper_set_subscriptions                                                                                      |
| wallpaper_subscription_data                                                                                      |
| withoutActuallyEscaping                                                                                          |
| wrapIcon                                                                                                         |

### Assets Scanned

| Asset                                                                                                          | Status | Bytes   | Candidates |
| -------------------------------------------------------------------------------------------------------------- | ------ | ------- | ---------- |
| https://quizpractice.space/build/assets/app-RBuZ8P09.js                                                        | 200    | 37267   | 0          |
| https://quizpractice.space/build/assets/charts-DuNVE9IQ.js                                                     | 200    | 437678  | 1          |
| https://quizpractice.space/build/assets/vue-vendor-vP3gWW15.js                                                 | 200    | 307467  | 1          |
| https://quizpractice.space/build/assets/Home-K6T_mpzf.js                                                       | 200    | 20351   | 5          |
| https://quizpractice.space/build/assets/index-eztyB0sa.js                                                      | 200    | 899     | 0          |
| https://quizpractice.space/build/assets/Button.vue_vue_type_script_setup_true_lang-81dIxWJ9.js                 | 200    | 1299    | 0          |
| https://quizpractice.space/build/assets/NavBar.vue_vue_type_script_setup_true_lang-DKoyJ7zV.js                 | 200    | 54475   | 3          |
| https://quizpractice.space/build/assets/CardContent.vue_vue_type_script_setup_true_lang-Cj07pZIG.js            | 200    | 579     | 0          |
| https://quizpractice.space/build/assets/CardHeader.vue_vue_type_script_setup_true_lang-BJP0RriH.js             | 200    | 355     | 0          |
| https://quizpractice.space/build/assets/CardTitle.vue_vue_type_script_setup_true_lang-DRR8VR6q.js              | 200    | 376     | 0          |
| https://quizpractice.space/build/assets/icons-t05HDZeb.js                                                      | 200    | 41655   | 3          |
| https://quizpractice.space/build/assets/index-gwEqMIzc.js                                                      | 200    | 22515   | 1          |
| https://quizpractice.space/build/assets/Footer-B-6feLmX.js                                                     | 200    | 1499    | 0          |
| https://quizpractice.space/build/assets/DialogDescription.vue_vue_type_script_setup_true_lang-Bk3mojpt.js      | 200    | 1155    | 0          |
| https://quizpractice.space/build/assets/ui-BKfYLrk2.js                                                         | 200    | 231599  | 0          |
| https://quizpractice.space/build/assets/DialogFooter.vue_vue_type_script_setup_true_lang-DVx6_7bZ.js           | 200    | 389     | 0          |
| https://quizpractice.space/build/assets/Separator.vue_vue_type_script_setup_true_lang-CuaEwaTY.js              | 200    | 895     | 0          |
| https://quizpractice.space/build/assets/Contact-B9hTGlJb.js                                                    | 200    | 1029    | 0          |
| https://quizpractice.space/build/assets/PrivacyPolicy--XpTEqg7.js                                              | 200    | 3441    | 0          |
| https://quizpractice.space/build/assets/SolutionPostingConditions-CVsPxfmN.js                                  | 200    | 4702    | 1          |
| https://quizpractice.space/build/assets/Team-DruETaGF.js                                                       | 200    | 13395   | 0          |
| https://quizpractice.space/build/assets/TermOfService-D4LwxTAN.js                                              | 200    | 4564    | 0          |
| https://quizpractice.space/build/assets/Index-DQxUMV0x.js                                                      | 200    | 8433    | 0          |
| https://quizpractice.space/build/assets/TableRow.vue_vue_type_script_setup_true_lang-YFkZmDmz.js               | 200    | 1632    | 0          |
| https://quizpractice.space/build/assets/BarChart.vue_vue_type_script_setup_true_lang-CPnlC4g6.js               | 200    | 5300    | 0          |
| https://quizpractice.space/build/assets/AdminNav.vue_vue_type_script_setup_true_lang-gxJUlNvj.js               | 200    | 1473    | 6          |
| https://quizpractice.space/build/assets/Index-wWo1XOvJ.js                                                      | 200    | 5987    | 0          |
| https://quizpractice.space/build/assets/Input.vue_vue_type_script_setup_true_lang-DSybzOQ6.js                  | 200    | 869     | 0          |
| https://quizpractice.space/build/assets/Switch.vue_vue_type_script_setup_true_lang-GUYFHBsq.js                 | 200    | 1239    | 0          |
| https://quizpractice.space/build/assets/Index-C5nK1--s.js                                                      | 200    | 5134    | 4          |
| https://quizpractice.space/build/assets/Review-D4DXXdqZ.js                                                     | 200    | 7520    | 6          |
| https://quizpractice.space/build/assets/Label.vue_vue_type_script_setup_true_lang-Ese3sLTx.js                  | 200    | 581     | 0          |
| https://quizpractice.space/build/assets/Textarea.vue_vue_type_script_setup_true_lang-DVDeRA1i.js               | 200    | 820     | 0          |
| https://quizpractice.space/build/assets/Index-CIE3Y76S.js                                                      | 200    | 12145   | 4          |
| https://quizpractice.space/build/assets/SelectScrollDownButton.vue_vue_type_script_setup_true_lang-DxlRbQya.js | 200    | 4749    | 0          |
| https://quizpractice.space/build/assets/Login-CYYxhCOG.js                                                      | 200    | 1411    | 0          |
| https://quizpractice.space/build/assets/CardDescription.vue_vue_type_script_setup_true_lang-D2wfGokL.js        | 200    | 360     | 0          |
| https://quizpractice.space/build/assets/SignIn.vue_vue_type_script_setup_true_lang-DIqB3-lJ.js                 | 200    | 2031    | 0          |
| https://quizpractice.space/build/assets/index-SoEJnJuw.js                                                      | 200    | 739     | 0          |
| https://quizpractice.space/build/assets/AlertTitle.vue_vue_type_script_setup_true_lang-Bh49f1Wu.js             | 200    | 371     | 0          |
| https://quizpractice.space/build/assets/Index-DQ5AJYUp.js                                                      | 200    | 2066    | 0          |
| https://quizpractice.space/build/assets/ContributionIndex-B4Uq9y1Y.js                                          | 200    | 10640   | 1          |
| https://quizpractice.space/build/assets/Dashboard-BL14P5Cw.js                                                  | 200    | 6608    | 0          |
| https://quizpractice.space/build/assets/MarkdownUsage-BzWzlJYb.js                                              | 200    | 11450   | 2          |
| https://quizpractice.space/build/assets/AlertDescription.vue_vue_type_script_setup_true_lang-DEzyGUy0.js       | 200    | 363     | 0          |
| https://quizpractice.space/build/assets/TabsContent.vue_vue_type_script_setup_true_lang-q5cuUf5O.js            | 200    | 2183    | 0          |
| https://quizpractice.space/build/assets/markdown-CIDQoS-9.js                                                   | 200    | 1556311 | 53         |
| https://quizpractice.space/build/assets/highlight-B_Z1okoj.js                                                  | 200    | 509     | 0          |
| https://quizpractice.space/build/assets/mermaid-BILMdyrF.js                                                    | 200    | 2432969 | 13         |
| https://quizpractice.space/build/assets/editor-CpQ5Qixa.js                                                     | 200    | 1071548 | 14         |
| https://quizpractice.space/build/assets/ImageZoom-CDSq-jql.js                                                  | 200    | 1565    | 0          |
| https://quizpractice.space/build/assets/ShowQuestionPapers-qA885ILN.js                                         | 200    | 9953    | 5          |
| https://quizpractice.space/build/assets/CommandList.vue_vue_type_script_setup_true_lang-CD64McyA.js            | 200    | 4153    | 0          |
| https://quizpractice.space/build/assets/PopoverContent.vue_vue_type_script_setup_true_lang-Nf2Q3WTy.js         | 200    | 1952    | 0          |
| https://quizpractice.space/build/assets/Show-CcksOafA.js                                                       | 200    | 1775    | 0          |
| https://quizpractice.space/build/assets/Practise-BhRMIoFM.js                                                   | 200    | 1051    | 0          |
| https://quizpractice.space/build/assets/MainLayout.vue_vue_type_script_setup_true_lang-B2yR3uiP.js             | 200    | 6396    | 1          |
| https://quizpractice.space/build/assets/Repository-CxjHH0PK.js                                                 | 200    | 11294   | 8          |
| https://quizpractice.space/build/assets/UploadNew-CV1mgQN-.js                                                  | 200    | 633     | 1          |
| https://quizpractice.space/build/assets/QuizEvaluationIndex-D2BfIYQ5.js                                        | 200    | 10492   | 0          |
| https://quizpractice.space/build/assets/Progress.vue_vue_type_script_setup_true_lang-CxK9sxg7.js               | 200    | 732     | 0          |
| https://quizpractice.space/build/assets/PractiseQuestionPaper-CpNahnkp.js                                      | 200    | 17091   | 7          |
| https://quizpractice.space/build/assets/RemoveAdModal.vue_vue_type_script_setup_true_lang-D1J2HUHP.js          | 200    | 267976  | 29         |
| https://quizpractice.space/build/assets/ViewQuestion-CJ-Ku6os.js                                               | 200    | 31014   | 13         |
| https://quizpractice.space/build/assets/Create-DCSfYKK3.js                                                     | 200    | 103460  | 3          |
| https://quizpractice.space/build/assets/SubscribePage-yK8s-aD2.js                                              | 200    | 7799    | 3          |
| https://quizpractice.space/build/assets/Profile-BonnmGSc.js                                                    | 200    | 17079   | 8          |
| https://quizpractice.space/build/assets/BadgeDisplay-BCdvDyMf.js                                               | 200    | 3068    | 0          |
| https://quizpractice.space/build/assets/PublicUser-Bb6LhvTE.js                                                 | 200    | 12143   | 2          |
| https://quizpractice.space/build/assets/Welcome-CuZ2-4HN.js                                                    | 200    | 13661   | 0          |
| https://quizpractice.space/build/assets/CkeEditorCustom-DVdwKdTP.js                                            | 200    | 3116    | 0          |

## Exam Samples

| Exam          | Status | Component               | Courses | Paper groups | Papers | First paper                                           | Questions |
| ------------- | ------ | ----------------------- | ------- | ------------ | ------ | ----------------------------------------------------- | --------- |
| Quiz 1        | 200    | Exam/ShowQuestionPapers | 95      | 12           | 74     | CT 15 Mar 26 (4b15c17c-372)                           | 11        |
| Quiz 2        | 200    | Exam/ShowQuestionPapers | 70      | 11           | 64     | CT 06 Apr 26 (e90571c9-daa)                           | 14        |
| End Term Quiz | 200    | Exam/ShowQuestionPapers | 95      | 3            | 10     | IIT M DAD DS QUALIFIER AN EXAM QDS1 13 (7dc70481-202) | 18        |
| OPPE          | 200    | Exam/ShowQuestionPapers | 1       | 1            | 1      | May 2024 OPPE 1 SET 1 (66f4b08b-d72)                  | 10        |

## Schema Signals

### Quiz 1

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, exam, courses
- First courses: 1:CT:aafc9bea-36af-4072-95e6-9e4a54ddcc15 | 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f | 3:Maths2:a43575cf-a995-4d73-a478-61f57712531d | 4:Statistics2:32709c56-1eb0-49d5-b635-4a4e5ac8c95b | 5:DBMS:03a941f8-8b2f-433a-bf35-6fd22c0cd886
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: question:GGWQZRABTc1DlRV8jDQt3gISA1VuL9DQmMIn4mQd2uB93uirhZ.png | question:aD4u5grVCqMlztCoTSnHDNcj7URRQztp4t6Rv6Pg7TeZaVPjnu.png | question:IxFGWZigYwu4khild3z7Pcn4Bf3ivmk2HPHJFxA51gwALRYgZ9.png | question:54mmatLDoTLxF7GdswkLuROO2InT1eqEVuRcHZ5q9KaQPSkvgE.png | option:app/option_images/0FSvxMfZWxkygsDJBJ0DyUlZ906w4zvgYZYMolliYpGFFCL6Oh.png | option:app/option_images/myoooaMLzPnDQI6cJB1lagL0aFI60thKqzItyNTrSOAzhXRIze.png | option:app/option_images/thPv8TYQ16FeSBiPW7MYhalq4XOJANZoAvsOG9WcwcVXb5WbCK.png | option:app/option_images/QxTYbEKPh2qsJ6Th52P7FxFD0q80Dm20G1Pbiycgb7fRzucLc6.png
- Endpoint probes:
| Method | Path                                                                            | Status | Content-Type     |
| ------ | ------------------------------------------------------------------------------- | ------ | ---------------- |
| GET    | /api/question/123506/solutions                                                  | 404    | application/json |
| GET    | /api/question/f12e3656-c3c1-42c9-a9e2-b8203b0eddab/solutions                    | 404    | application/json |
| GET    | /api/question/f12e3656-c3c1-42c9-a9e2-b8203b0eddab                              | 404    | application/json |
| GET    | /api/question/123506/comments                                                   | 404    | application/json |
| GET    | /app/question_images/GGWQZRABTc1DlRV8jDQt3gISA1VuL9DQmMIn4mQd2uB93uirhZ.png     | 404    | application/json |
| GET    | /storage/question_images/GGWQZRABTc1DlRV8jDQt3gISA1VuL9DQmMIn4mQd2uB93uirhZ.png | 404    | application/json |
| GET    | /app/question_images/aD4u5grVCqMlztCoTSnHDNcj7URRQztp4t6Rv6Pg7TeZaVPjnu.png     | 404    | application/json |
| GET    | /storage/question_images/aD4u5grVCqMlztCoTSnHDNcj7URRQztp4t6Rv6Pg7TeZaVPjnu.png | 404    | application/json |

### Quiz 2

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, exam, courses
- First courses: 1:CT:aafc9bea-36af-4072-95e6-9e4a54ddcc15 | 16:Maths1:515bc074-a938-4960-8cdb-62bda8595293 | 17:Statistics1:642ae281-a693-4a49-aeaa-0dc6be51e4fc | 3:Maths2:a43575cf-a995-4d73-a478-61f57712531d | 4:Statistics2:32709c56-1eb0-49d5-b635-4a4e5ac8c95b
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: question:AkaziHSpjIjx54y7ahDHpQUoXITCOcA94yUjtrSfQ4PFeoTJm4.png | question:Agx6DCK1uUTvmFCWEkZADteu5EiikrB0zbmAzbg2jeaVf83URY.png | question:bMofaL2rJ9aeApwerh9E4HVotWOezAP1Wof4l2Q1MTVTeba3xt.png | question:Bxe1oH2SYqo34hDRY07nxsd0aoUphD9Ph1Q1y5kyfraeWGanWB.png | question:Q4I6rDtT20QvShK4qrucngOXAsnr0PXwbZS0wuTVFUXMMUfzVb.png | question:zO3JUCaMPpsQyKqK4sKIpCEfzSx6YUByIkZoNbMOZpqiVqbyr3.png | question:kzCsWdQO879iGeyhScyEb9UGPcgnG4dakFwCdsxVSzgB0nd92R.png | question:bnd9rfrCfMtUS4r3tnfFcoSOeVbTOkpKbwpqetiIqlA9TGEpPI.png
- Endpoint probes:
| Method | Path                                                                            | Status | Content-Type     |
| ------ | ------------------------------------------------------------------------------- | ------ | ---------------- |
| GET    | /api/question/123946/solutions                                                  | 404    | application/json |
| GET    | /api/question/3e067b9a-8963-4019-8aa1-9b991872772a/solutions                    | 404    | application/json |
| GET    | /api/question/3e067b9a-8963-4019-8aa1-9b991872772a                              | 404    | application/json |
| GET    | /api/question/123946/comments                                                   | 404    | application/json |
| GET    | /app/question_images/AkaziHSpjIjx54y7ahDHpQUoXITCOcA94yUjtrSfQ4PFeoTJm4.png     | 404    | application/json |
| GET    | /storage/question_images/AkaziHSpjIjx54y7ahDHpQUoXITCOcA94yUjtrSfQ4PFeoTJm4.png | 404    | application/json |
| GET    | /app/question_images/Agx6DCK1uUTvmFCWEkZADteu5EiikrB0zbmAzbg2jeaVf83URY.png     | 404    | application/json |
| GET    | /storage/question_images/Agx6DCK1uUTvmFCWEkZADteu5EiikrB0zbmAzbg2jeaVf83URY.png | 404    | application/json |

### End Term Quiz

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, exam, courses
- First courses: 35:English:21765e71-5dd0-4348-9339-ada4e2e3ce00 | 36:Aptitude:6f51716a-11e7-41de-b15c-a52f03bc0825 | 37:Basic Mathematics:c1e47a84-69eb-4f88-bfcc-db284746b398 | 38:Programming in Python:cb200653-e8ec-4cf1-9230-ea4a8d6f1210 | 39:Mathematics:cb2ef51d-dc1e-4ca5-8d04-65812c43c4e5
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: none in sampled paper
- Endpoint probes:
| Method | Path                                                         | Status | Content-Type     |
| ------ | ------------------------------------------------------------ | ------ | ---------------- |
| GET    | /api/question/76945/solutions                                | 404    | application/json |
| GET    | /api/question/a09243c9-3869-4685-b62d-8495233c7c8e/solutions | 404    | application/json |
| GET    | /api/question/a09243c9-3869-4685-b62d-8495233c7c8e           | 404    | application/json |
| GET    | /api/question/76945/comments                                 | 404    | application/json |

### OPPE

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, exam, courses
- First courses: 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys:
- Image examples: none in sampled paper
- Endpoint probes:
| Method | Path                                                         | Status | Content-Type     |
| ------ | ------------------------------------------------------------ | ------ | ---------------- |
| GET    | /api/question/68504/solutions                                | 404    | application/json |
| GET    | /api/question/b0fb52f9-fea6-4a94-ab3f-46eed064723b/solutions | 404    | application/json |
| GET    | /api/question/b0fb52f9-fea6-4a94-ab3f-46eed064723b           | 404    | application/json |
| GET    | /api/question/68504/comments                                 | 404    | application/json |


## Initial Conclusions

- The site still uses the same Inertia mechanism and the scraper's core route assumptions remain valid.
- The home page now advertises current asset bundle names; this report should be regenerated before major rescrapes.
- The sampled Quiz 1 paper list contains current/future 2026 paper metadata, so local data is stale.
- Extra solution/comment/question API patterns still need to be treated as opportunistic; they are probed here but should not block scraping.
