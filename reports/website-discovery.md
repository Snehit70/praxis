# QuizPractice Website Discovery

Generated: 2026-09-19T04:24:44.842Z

## Home

| Metric                     | Value                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                     | 200                                                                                                                                                                                        |
| Title                      | QuizPractice | IITM BS Degree Question Papers                                                                                                                                              |
| Component                  | Home                                                                                                                                                                                       |
| Inertia version            | 433a962660a1162afbb9104369113a3a                                                                                                                                                           |
| Home prop keys             | errors, auth, flash, banner, file_url, file_do_url, subscription_config, exam_date, feedbacks, courses, exams, online_users                                                                |
| Home exams                 | Quiz 1:9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa | Quiz 2:1948ee72-5c62-4816-97c8-7d662330a220 | End Term Quiz:7a6ff569-f50c-40e7-a08b-f5c334392600 | OPPE:4e5fffd3-41e9-4ec7-853c-8af983edb699 |
| Home courses prop count    | 3                                                                                                                                                                                          |
| Asset links                | 25                                                                                                                                                                                         |
| Ziggy routes               | 149                                                                                                                                                                                        |
| Interesting routes         | 93                                                                                                                                                                                         |
| JS assets scanned          | 84                                                                                                                                                                                         |
| Bundle endpoint candidates | 176                                                                                                                                                                                        |

## Ziggy Route Table

These are server-advertised route names and URI templates embedded in the current HTML. This is the most reliable endpoint discovery source.

| Name                                    | Methods   | URI                                                   | Params                 |
| --------------------------------------- | --------- | ----------------------------------------------------- | ---------------------- |
| admin.blog.topics                       | GET,HEAD  | admin/blog/topics                                     |                        |
| admin.blog.topics.destroy               | DELETE    | admin/blog/topics/{topic}                             | topic                  |
| admin.blog.topics.store                 | POST      | admin/blog/topics                                     |                        |
| admin.course-aliases.destroy            | DELETE    | admin/course-aliases/{courseAlias}                    | courseAlias            |
| admin.course-aliases.index              | GET,HEAD  | admin/course-aliases                                  |                        |
| admin.course-aliases.merge              | POST      | admin/course-aliases/merge                            |                        |
| admin.course-aliases.store              | POST      | admin/course-aliases                                  |                        |
| admin.exam.create                       | GET,HEAD  | admin/exam/create                                     |                        |
| admin.exam.destroy                      | DELETE    | admin/exam/{exam}                                     | exam                   |
| admin.exam.edit                         | GET,HEAD  | admin/exam/{exam}/edit                                | exam                   |
| admin.exam.index                        | GET,HEAD  | admin/exam                                            |                        |
| admin.exam.show                         | GET,HEAD  | admin/exam/{exam}                                     | exam                   |
| admin.exam.store                        | POST      | admin/exam                                            |                        |
| admin.exam.update                       | PUT,PATCH | admin/exam/{exam}                                     | exam                   |
| admin.generated.approve                 | POST      | admin/generated/{questionPaper}/approve               | questionPaper          |
| admin.generated.questions.destroy       | DELETE    | admin/generated/{questionPaper}/questions/{question}  | questionPaper,question |
| admin.generated.reject                  | POST      | admin/generated/{questionPaper}/reject                | questionPaper          |
| admin.generated.show                    | GET,HEAD  | admin/generated/{questionPaper}                       | questionPaper          |
| admin.question-paper.create             | GET,HEAD  | admin/question-paper/create                           |                        |
| admin.question-paper.destroy            | DELETE    | admin/question-paper/{question_paper}                 | question_paper         |
| admin.question-paper.edit               | GET,HEAD  | admin/question-paper/{question_paper}/edit            | question_paper         |
| admin.question-paper.generate-summary   | POST      | admin/question-paper/{questionPaper}/summary/generate | questionPaper          |
| admin.question-paper.get-summary        | GET,HEAD  | admin/question-paper/{questionPaper}/summary          | questionPaper          |
| admin.question-paper.index              | GET,HEAD  | admin/question-paper                                  |                        |
| admin.question-paper.show               | GET,HEAD  | admin/question-paper/{question_paper}                 | question_paper         |
| admin.question-paper.store              | POST      | admin/question-paper                                  |                        |
| admin.question-paper.summary-list       | GET,HEAD  | admin/question-paper-summary                          |                        |
| admin.question-paper.update             | PUT,PATCH | admin/question-paper/{question_paper}                 | question_paper         |
| admin.question-paper.update-summary     | PUT       | admin/question-paper/{questionPaper}/summary          | questionPaper          |
| admin.questions.create                  | GET,HEAD  | admin/questions/create                                |                        |
| admin.questions.destroy                 | DELETE    | admin/questions/{question}                            | question               |
| admin.questions.edit                    | GET,HEAD  | admin/questions/{question}/edit                       | question               |
| admin.questions.index                   | GET,HEAD  | admin/questions                                       |                        |
| admin.questions.show                    | GET,HEAD  | admin/questions/{question}                            | question               |
| admin.questions.store                   | POST      | admin/questions                                       |                        |
| admin.questions.update                  | PUT,PATCH | admin/questions/{question}                            | question               |
| admin.submissions.approve               | POST      | admin/submissions/{submission}/approve                | submission             |
| admin.submissions.bulk-reject           | POST      | admin/submissions/bulk-reject                         |                        |
| admin.submissions.index                 | GET,HEAD  | admin/submissions                                     |                        |
| admin.submissions.pdf                   | GET,HEAD  | admin/submissions/{submission}/pdf                    | submission             |
| admin.submissions.reject                | POST      | admin/submissions/{submission}/reject                 | submission             |
| admin.submissions.show                  | GET,HEAD  | admin/submissions/{submission}                        | submission             |
| admin.subscriptions.check-pending       | POST      | admin/subscriptions/check-pending                     |                        |
| admin.subscriptions.config              | POST      | admin/subscriptions/config                            |                        |
| admin.subscriptions.index               | GET,HEAD  | admin/subscriptions                                   |                        |
| api.                                    | GET,HEAD  | api/topics                                            |                        |
| api.event-log.store                     | POST      | api/event-log                                         |                        |
| api.question-paper.log_test             | POST      | api/question-paper/log_test                           |                        |
| api.question.flag                       | POST      | api/question/flag                                     |                        |
| api.submissions.approve                 | GET,HEAD  | api/submissions/{submission}/approve                  | submission             |
| api.topics.stats                        | GET,HEAD  | api/questions/{question}/topic-stats                  | question               |
| blog.topics.store                       | POST      | blog/topics                                           |                        |
| documentation.solutionPostingConditions | GET,HEAD  | documentation/solution-posting-conditions             |                        |
| exam.show                               | GET,HEAD  | exam/{exam}                                           | exam                   |
| ignition.executeSolution                | POST      | _ignition/execute-solution                            |                        |
| profile                                 | GET,HEAD  | profile                                               |                        |
| public_profile                          | GET,HEAD  | u/{username}                                          | username               |
| python.practise                         | GET,HEAD  | python/practise                                       |                        |
| question-paper.download                 | GET,HEAD  | question-paper/download/{course_id}/{id}              | course_id,id           |
| question-paper.download-pdf             | GET,HEAD  | question-paper/download-pdf/{course_id}/{id}          | course_id,id           |
| question-paper.practise                 | GET,HEAD  | question-paper/practise/{course_id}/{id}              | course_id,id           |
| question-paper.upload                   | GET,HEAD  | question-paper/upload                                 |                        |
| question-paper.upload-post              | POST      | question-paper/upload-post                            |                        |
| question-paper.view-question            | GET,HEAD  | question-paper/view-question/{question}               | question               |
| questions.comments.destroy              | DELETE    | questions/comments/{comment}                          | comment                |
| questions.comments.fetch                | GET,HEAD  | questions/{question}/comments                         | question               |
| questions.comments.index                | GET,HEAD  | questions/questions/{question}/discussion             | question               |
| questions.comments.store                | POST      | questions/comments                                    |                        |
| questions.comments.toggle-like          | POST      | questions/comments/{comment}/toggle-like              | comment                |
| questions.corrections.destroy           | DELETE    | questions/corrections/{correction}                    | correction             |
| questions.corrections.index             | GET,HEAD  | questions/{question}/corrections                      | question               |
| questions.corrections.store             | POST      | questions/{question}/corrections                      | question               |
| questions.corrections.vote              | POST      | questions/corrections/{correction}/vote               | correction             |
| questions.format-fix.store              | POST      | questions/{question}/format-fix                       | question               |
| questions.generate-ai-answer-stream     | POST      | questions/generate-ai-answer-stream                   |                        |
| questions.repository                    | GET,HEAD  | questions/repository                                  |                        |
| questions.search_repository             | POST      | questions/repository                                  |                        |
| questions.solution.destroy              | DELETE    | questions/{question}/solution                         | question               |
| questions.solution.index                | GET,HEAD  | questions/{question}/solution                         | question               |
| questions.solution.store                | POST      | questions/{question}/solution                         | question               |
| questions.solution.update               | PUT       | questions/{question}/solution                         | question               |
| solutions.downvote                      | POST      | solutions/{solution}/downvote                         | solution               |
| solutions.upvote                        | POST      | solutions/{solution}/upvote                           | solution               |
| solutions.view_log                      | POST      | solutions/{solution}/view_log                         | solution               |
| submissions.create                      | GET,HEAD  | submissions                                           |                        |
| submissions.store                       | POST      | submissions                                           |                        |
| subscription.check-status               | POST      | subscribe/check-status                                |                        |
| subscription.index                      | GET,HEAD  | subscribe                                             |                        |
| subscription.order                      | POST      | subscribe/order                                       |                        |
| subscription.verify                     | POST      | subscribe/verify                                      |                        |
| user.profile_picture                    | GET,HEAD  | user/profile_picture                                  |                        |
| user.show_profile_picture               | GET,HEAD  | user/show_profile_picture/{name}                      | name                   |
| user.toggle_profile_picture_visibility  | POST      | user/toggle-profile-picture-visibility                |                        |

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
| Paper                                                                                                            |
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
| SubscriptionEndedModal                                                                                           |
| Subscriptions                                                                                                    |
| SystemModelExamples                                                                                              |
| Topics                                                                                                           |
| VerifySolutions                                                                                                  |
| ViewQuestion                                                                                                     |
| WaveletMapIndexed                                                                                                |
| WidgetToolbarRepository                                                                                          |
| ZapIcon                                                                                                          |
| _conversionApi                                                                                                   |
| admin.blog.topics                                                                                                |
| admin.blog.topics.destroy                                                                                        |
| admin.blog.topics.store                                                                                          |
| admin.generated.questions.destroy                                                                                |
| admin.questions.index                                                                                            |
| admin.submissions.approve                                                                                        |
| admin.submissions.bulk-reject                                                                                    |
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
| blog.topics.store                                                                                                |
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
| subscription_ended_modal_last_shown                                                                              |
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
| https://quizpractice.space/build/assets/app-CBOThVPE.js                                                        | 200    | 39030   | 0          |
| https://quizpractice.space/build/assets/charts-BFt4qWY2.js                                                     | 200    | 448541  | 1          |
| https://quizpractice.space/build/assets/vue-vendor-BxazpcKq.js                                                 | 200    | 307356  | 1          |
| https://quizpractice.space/build/assets/Home-B0v3w305.js                                                       | 200    | 16047   | 3          |
| https://quizpractice.space/build/assets/index-Di9IpFdi.js                                                      | 200    | 899     | 0          |
| https://quizpractice.space/build/assets/Button.vue_vue_type_script_setup_true_lang-BCtUxxu3.js                 | 200    | 1299    | 0          |
| https://quizpractice.space/build/assets/NavBar.vue_vue_type_script_setup_true_lang-CJUkIb2t.js                 | 200    | 64558   | 9          |
| https://quizpractice.space/build/assets/CardContent.vue_vue_type_script_setup_true_lang-_XyUQ69a.js            | 200    | 579     | 0          |
| https://quizpractice.space/build/assets/CardHeader.vue_vue_type_script_setup_true_lang-BevhWqPP.js             | 200    | 355     | 0          |
| https://quizpractice.space/build/assets/CardTitle.vue_vue_type_script_setup_true_lang-BDx83kyb.js              | 200    | 376     | 0          |
| https://quizpractice.space/build/assets/icons-BGhOGdSc.js                                                      | 200    | 44733   | 3          |
| https://quizpractice.space/build/assets/index-gwEqMIzc.js                                                      | 200    | 22515   | 1          |
| https://quizpractice.space/build/assets/Footer-Czvfo-mJ.js                                                     | 200    | 1499    | 0          |
| https://quizpractice.space/build/assets/ui-C9OTWcPb.js                                                         | 200    | 233836  | 0          |
| https://quizpractice.space/build/assets/Separator.vue_vue_type_script_setup_true_lang-D8B6gCqI.js              | 200    | 894     | 0          |
| https://quizpractice.space/build/assets/Contact-Bn-KnFf9.js                                                    | 200    | 1029    | 0          |
| https://quizpractice.space/build/assets/PrivacyPolicy-DVCARZbw.js                                              | 200    | 3441    | 0          |
| https://quizpractice.space/build/assets/SolutionPostingConditions-CZrpCMeg.js                                  | 200    | 4702    | 1          |
| https://quizpractice.space/build/assets/Team-CVQyIuPU.js                                                       | 200    | 13395   | 0          |
| https://quizpractice.space/build/assets/TermOfService-BtT6RDrk.js                                              | 200    | 4564    | 0          |
| https://quizpractice.space/build/assets/Index-BSC_6nOi.js                                                      | 200    | 4302    | 2          |
| https://quizpractice.space/build/assets/AdminNav.vue_vue_type_script_setup_true_lang-NHkodgPS.js               | 200    | 1663    | 6          |
| https://quizpractice.space/build/assets/TableRow.vue_vue_type_script_setup_true_lang-BjAwGfvm.js               | 200    | 1632    | 0          |
| https://quizpractice.space/build/assets/Show-GGA31WNY.js                                                       | 200    | 4287    | 0          |
| https://quizpractice.space/build/assets/Textarea.vue_vue_type_script_setup_true_lang-jfyAPEm_.js               | 200    | 825     | 0          |
| https://quizpractice.space/build/assets/BlogContent.vue_vue_type_style_index_0_lang-T4UI7u89.js                | 200    | 1880    | 0          |
| https://quizpractice.space/build/assets/markdown-BtWgFDiD.js                                                   | 200    | 1556341 | 53         |
| https://quizpractice.space/build/assets/Topics-CfA-JcpZ.js                                                     | 200    | 3317    | 3          |
| https://quizpractice.space/build/assets/Input.vue_vue_type_script_setup_true_lang-DW3DEeyE.js                  | 200    | 874     | 0          |
| https://quizpractice.space/build/assets/Index-8reBvHt4.js                                                      | 200    | 6262    | 0          |
| https://quizpractice.space/build/assets/BarChart.vue_vue_type_script_setup_true_lang-ya5sUSgG.js               | 200    | 5300    | 0          |
| https://quizpractice.space/build/assets/LineChart.vue_vue_type_script_setup_true_lang-qo0vkfV5.js              | 200    | 2484    | 0          |
| https://quizpractice.space/build/assets/Index-ohhhtep_.js                                                      | 200    | 20400   | 0          |
| https://quizpractice.space/build/assets/Label.vue_vue_type_script_setup_true_lang-C0g12Pi2.js                  | 200    | 580     | 0          |
| https://quizpractice.space/build/assets/Switch.vue_vue_type_script_setup_true_lang-tMuUAC54.js                 | 200    | 1237    | 0          |
| https://quizpractice.space/build/assets/Index-BKiBiw2K.js                                                      | 200    | 5982    | 0          |
| https://quizpractice.space/build/assets/Index-l2KU42hr.js                                                      | 200    | 5001    | 4          |
| https://quizpractice.space/build/assets/Show-BQOlf4En.js                                                       | 200    | 6864    | 1          |
| https://quizpractice.space/build/assets/highlight-pSbpCgvE.js                                                  | 200    | 509     | 0          |
| https://quizpractice.space/build/assets/mermaid-EnuxIeI8.js                                                    | 200    | 2434240 | 13         |
| https://quizpractice.space/build/assets/editor-CL-xzQc9.js                                                     | 200    | 1072425 | 14         |
| https://quizpractice.space/build/assets/Index-C-vGey4t.js                                                      | 200    | 12814   | 7          |
| https://quizpractice.space/build/assets/Checkbox.vue_vue_type_script_setup_true_lang-D6LCZzyM.js               | 200    | 1163    | 0          |
| https://quizpractice.space/build/assets/SelectScrollDownButton.vue_vue_type_script_setup_true_lang-Di7eKIyl.js | 200    | 4750    | 0          |
| https://quizpractice.space/build/assets/Review-DxGl4X5l.js                                                     | 200    | 7768    | 6          |
| https://quizpractice.space/build/assets/Index-C0MXz6wG.js                                                      | 200    | 15790   | 4          |
| https://quizpractice.space/build/assets/Login-DlE_AJ26.js                                                      | 200    | 1411    | 0          |
| https://quizpractice.space/build/assets/CardDescription.vue_vue_type_script_setup_true_lang-Bg_jOzQu.js        | 200    | 360     | 0          |
| https://quizpractice.space/build/assets/SignIn.vue_vue_type_script_setup_true_lang-Cvysh_y9.js                 | 200    | 2031    | 0          |
| https://quizpractice.space/build/assets/index-Dvgcx_2w.js                                                      | 200    | 739     | 0          |
| https://quizpractice.space/build/assets/AlertTitle.vue_vue_type_script_setup_true_lang-ZsJ6YRI-.js             | 200    | 371     | 0          |
| https://quizpractice.space/build/assets/Editor-BFbKNBEi.js                                                     | 200    | 10925   | 1          |
| https://quizpractice.space/build/assets/Index-DUT88meF.js                                                      | 200    | 6593    | 0          |
| https://quizpractice.space/build/assets/My-CFf5alvB.js                                                         | 200    | 4482    | 0          |
| https://quizpractice.space/build/assets/Show-DS8pYeQ2.js                                                       | 200    | 5610    | 0          |
| https://quizpractice.space/build/assets/ContributionIndex-CxpDc-AF.js                                          | 200    | 10910   | 1          |
| https://quizpractice.space/build/assets/Dashboard-BUw_VdVJ.js                                                  | 200    | 6608    | 0          |
| https://quizpractice.space/build/assets/MarkdownUsage-_CsvhwGh.js                                              | 200    | 11450   | 2          |
| https://quizpractice.space/build/assets/AlertDescription.vue_vue_type_script_setup_true_lang-C_Y8rqu9.js       | 200    | 363     | 0          |
| https://quizpractice.space/build/assets/TabsContent.vue_vue_type_script_setup_true_lang-B9Cg-qk7.js            | 200    | 2183    | 0          |
| https://quizpractice.space/build/assets/ImageZoom-DAPXZYG2.js                                                  | 200    | 1565    | 0          |
| https://quizpractice.space/build/assets/Error-C9ABXWAK.js                                                      | 200    | 1722    | 0          |
| https://quizpractice.space/build/assets/MainLayout.vue_vue_type_script_setup_true_lang-CZ_t3Ivi.js             | 200    | 6244    | 1          |
| https://quizpractice.space/build/assets/ShowQuestionPapers-QEt9ZaeP.js                                         | 200    | 15398   | 5          |
| https://quizpractice.space/build/assets/CommandList.vue_vue_type_script_setup_true_lang-DjthGkwa.js            | 200    | 4158    | 0          |
| https://quizpractice.space/build/assets/PopoverContent.vue_vue_type_script_setup_true_lang-BiTtBh1u.js         | 200    | 1952    | 0          |
| https://quizpractice.space/build/assets/useAdsense-Dxsx_lnd.js                                                 | 200    | 1735    | 0          |
| https://quizpractice.space/build/assets/RemoveAdModal.vue_vue_type_script_setup_true_lang-D6mAozMy.js          | 200    | 7835    | 4          |
| https://quizpractice.space/build/assets/Show-B0jZVHwT.js                                                       | 200    | 1775    | 0          |
| https://quizpractice.space/build/assets/Practise-oqNsutg2.js                                                   | 200    | 904     | 0          |
| https://quizpractice.space/build/assets/Repository-Disui6Mn.js                                                 | 200    | 11337   | 8          |
| https://quizpractice.space/build/assets/UploadNew-CnpJssIl.js                                                  | 200    | 633     | 1          |
| https://quizpractice.space/build/assets/QuizEvaluationIndex-BFUGxskM.js                                        | 200    | 10494   | 0          |
| https://quizpractice.space/build/assets/Progress.vue_vue_type_script_setup_true_lang-BG41FAbm.js               | 200    | 732     | 0          |
| https://quizpractice.space/build/assets/PractiseQuestionPaper-Ut_u4BhH.js                                      | 200    | 21655   | 7          |
| https://quizpractice.space/build/assets/Question.vue_vue_type_script_setup_true_lang-CeF8lBnO.js               | 200    | 261494  | 25         |
| https://quizpractice.space/build/assets/ViewQuestion-C40oVtqW.js                                               | 200    | 31011   | 13         |
| https://quizpractice.space/build/assets/Create-Bl1pBH7D.js                                                     | 200    | 107211  | 4          |
| https://quizpractice.space/build/assets/SubscribePage-CjwYrF1v.js                                              | 200    | 7798    | 3          |
| https://quizpractice.space/build/assets/Profile-4GKYtAGI.js                                                    | 200    | 17075   | 8          |
| https://quizpractice.space/build/assets/BadgeDisplay-DIiFvX6_.js                                               | 200    | 3067    | 0          |
| https://quizpractice.space/build/assets/PublicUser-DdqlMYNR.js                                                 | 200    | 12264   | 3          |
| https://quizpractice.space/build/assets/Welcome-AJUyF7Hq.js                                                    | 200    | 13661   | 0          |
| https://quizpractice.space/build/assets/CkeEditorCustom-CjDUB1w_.js                                            | 200    | 4045    | 0          |

## Exam Samples

| Exam          | Status | Component               | Courses | Paper groups | Papers | First paper                          | Questions |
| ------------- | ------ | ----------------------- | ------- | ------------ | ------ | ------------------------------------ | --------- |
| Quiz 1        | 200    | Exam/ShowQuestionPapers | 83      | 14           | 78     | CT 16 Jul 26 (046647f6-226)          | 13        |
| Quiz 2        | 200    | Exam/ShowQuestionPapers | 62      | 12           | 65     | CT 14 Aug 26 (f88c911f-6f6)          | 14        |
| End Term Quiz | 200    | Exam/ShowQuestionPapers | 80      | 10           | 51     | CT 06 May 26 (a2817820-146)          | 46        |
| OPPE          | 200    | Exam/ShowQuestionPapers | 1       | 1            | 1      | May 2024 OPPE 1 SET 1 (66f4b08b-d72) | 10        |

## Schema Signals

### Quiz 1

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, subscription_config, exam, courses
- First courses: 1:CT:aafc9bea-36af-4072-95e6-9e4a54ddcc15 | 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f | 3:Maths2:a43575cf-a995-4d73-a478-61f57712531d | 4:Statistics2:32709c56-1eb0-49d5-b635-4a4e5ac8c95b | 5:DBMS:03a941f8-8b2f-433a-bf35-6fd22c0cd886
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, mark_percentage, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, source, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: question:w7147lsbf1tVIjtnIPKQ66GKnpQrVxyU2fYAEWZojAMrVjqQcy.png | question:dUbnyWM8Bd0xCNjUlTCqi7yHt4inq2NoZvpFWKs4kCg8XIE61F.png | question:OiFdrWtt57jcYKU7Wp1PGYouVJJ4dJd0LzUU1swqNSjfj4hUTo.png | question:Vd6GbGBq6DDzbLFcKCvLtjDWZneQYhnmg6yRIhaVOfdOV8YCyM.png | question:YPgNVEfwH6LBvGLasII7EDzTeoyjVCLBR8LYheKCySSetkVajT.png | question:6BdBtUDJBL37mbZ4Lj2gliOOVRKiuiqzqYyClWBe6LL1lIFkHs.png | question:7d1KVxXKigVDS2F9QdhO0HqhJ5qpF4qTJ6BaeJNDyXLjE3Mvmu.png | question:FyV2PtosoablfYBkQYQLwhzVHS2daRlts2bonqxY9fsIBX6y9f.png
- Endpoint probes:
| Method | Path                                                                            | Status | Content-Type     |
| ------ | ------------------------------------------------------------------------------- | ------ | ---------------- |
| GET    | /api/question/126500/solutions                                                  | 404    | application/json |
| GET    | /api/question/e7e8e9cf-2eb0-4345-85e0-eb75e33435ba/solutions                    | 404    | application/json |
| GET    | /api/question/e7e8e9cf-2eb0-4345-85e0-eb75e33435ba                              | 404    | application/json |
| GET    | /api/question/126500/comments                                                   | 404    | application/json |
| GET    | /app/question_images/w7147lsbf1tVIjtnIPKQ66GKnpQrVxyU2fYAEWZojAMrVjqQcy.png     | 404    | application/json |
| GET    | /storage/question_images/w7147lsbf1tVIjtnIPKQ66GKnpQrVxyU2fYAEWZojAMrVjqQcy.png | 404    | application/json |
| GET    | /app/question_images/dUbnyWM8Bd0xCNjUlTCqi7yHt4inq2NoZvpFWKs4kCg8XIE61F.png     | 404    | application/json |
| GET    | /storage/question_images/dUbnyWM8Bd0xCNjUlTCqi7yHt4inq2NoZvpFWKs4kCg8XIE61F.png | 404    | application/json |

### Quiz 2

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, subscription_config, exam, courses
- First courses: 1:CT:aafc9bea-36af-4072-95e6-9e4a54ddcc15 | 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f | 3:Maths2:a43575cf-a995-4d73-a478-61f57712531d | 4:Statistics2:32709c56-1eb0-49d5-b635-4a4e5ac8c95b | 5:DBMS:03a941f8-8b2f-433a-bf35-6fd22c0cd886
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, mark_percentage, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, source, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: question:inp5epR59tuSusoiLRHHapAf5qaywcQWRG23U8zcKijWEBwASp.png | question:UpajjfznkXPubORCNnRPJiZOW3gc14xorMstB48iyFq6sWvsLc.png | question:wRuB2AYgFsttfMcgCeZeIQUckFSFo8qA8izmnB5m1vPf4ijkQ8.png | question:vRLAMNgqmxiv06gRCItfk2LRP8YlmQ0r4KZDVIM8usAfPOgh0N.png | question:Uk0eewSaNmv2u9MeC9C1VvAdOTlLZBb5ocpm4sqVtwgoLegQkr.png | question:5yHYqYcy434NTmfiblbdUX8pdqbIzH5dco23JjS5Mz0I4eNERm.png | question:JzGQimDtXelEmKXpMUULeAyZTtrGUsaGqr5PWxrjVWh15N8esF.png | question:eNHz0hGMN53LuDm4jP5xu7JorOTLrMAHzQyq0uDqCLbXnqmeze.png
- Endpoint probes:
| Method | Path                                                                            | Status | Content-Type     |
| ------ | ------------------------------------------------------------------------------- | ------ | ---------------- |
| GET    | /api/question/128941/solutions                                                  | 404    | application/json |
| GET    | /api/question/afa5f305-0174-42b2-abd3-a9b8ad19ab88/solutions                    | 404    | application/json |
| GET    | /api/question/afa5f305-0174-42b2-abd3-a9b8ad19ab88                              | 404    | application/json |
| GET    | /api/question/128941/comments                                                   | 404    | application/json |
| GET    | /app/question_images/inp5epR59tuSusoiLRHHapAf5qaywcQWRG23U8zcKijWEBwASp.png     | 404    | application/json |
| GET    | /storage/question_images/inp5epR59tuSusoiLRHHapAf5qaywcQWRG23U8zcKijWEBwASp.png | 404    | application/json |
| GET    | /app/question_images/UpajjfznkXPubORCNnRPJiZOW3gc14xorMstB48iyFq6sWvsLc.png     | 404    | application/json |
| GET    | /storage/question_images/UpajjfznkXPubORCNnRPJiZOW3gc14xorMstB48iyFq6sWvsLc.png | 404    | application/json |

### End Term Quiz

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, subscription_config, exam, courses
- First courses: 1:CT:aafc9bea-36af-4072-95e6-9e4a54ddcc15 | 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f | 3:Maths2:a43575cf-a995-4d73-a478-61f57712531d | 4:Statistics2:32709c56-1eb0-49d5-b635-4a4e5ac8c95b | 5:DBMS:03a941f8-8b2f-433a-bf35-6fd22c0cd886
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, mark_percentage, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, source, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
- First option keys: id, question_id, option_text, option_image, score, is_correct, created_at, updated_at, option_number, option_image_url
- Image examples: question:VHwEcQCf9cXYkkvPWfyTP1vUB9ANTARPrZ8aX0IDAFpLGxI7M5.png | question:2rGRHaXHR2cHxGONdZp3CrStS09yAqCPF5zc7FEJ035rqsGcmQ.png | question:DFMirCn3OtCjtAwq91AP52rTamFXZOTxrh4cA9EMrQFqNb1tBv.png | question:1IregtT49KJtF5n7aYGHzMeDROMSBZuf3yrdz9ErUBd4fZ9Evf.png | option:app/option_images/OtTOfsXMiULo3EQ6mgTE1JYZUwpKP2YHc7ce0nDINXjz3XqFCA.png | option:app/option_images/ldG6Ld7wZEC2mZFQWOCTHJOKCmL65nhwN6l4HajybIRv1rwIQL.png | option:app/option_images/pv77oZFIwLE3Bx52duLvkyRyrEMvZLIPrcFQSiii06yy5yGHiP.png | option:app/option_images/NG9hehX0GSgyQZojALY2s70itCbHYWARHwqHXCZTTf0Z9IMiCv.png
- Endpoint probes:
| Method | Path                                                                            | Status | Content-Type     |
| ------ | ------------------------------------------------------------------------------- | ------ | ---------------- |
| GET    | /api/question/125043/solutions                                                  | 404    | application/json |
| GET    | /api/question/398e1ca7-af77-47df-959f-f7ba2c52db7f/solutions                    | 404    | application/json |
| GET    | /api/question/398e1ca7-af77-47df-959f-f7ba2c52db7f                              | 404    | application/json |
| GET    | /api/question/125043/comments                                                   | 404    | application/json |
| GET    | /app/question_images/VHwEcQCf9cXYkkvPWfyTP1vUB9ANTARPrZ8aX0IDAFpLGxI7M5.png     | 404    | application/json |
| GET    | /storage/question_images/VHwEcQCf9cXYkkvPWfyTP1vUB9ANTARPrZ8aX0IDAFpLGxI7M5.png | 404    | application/json |
| GET    | /app/question_images/2rGRHaXHR2cHxGONdZp3CrStS09yAqCPF5zc7FEJ035rqsGcmQ.png     | 404    | application/json |
| GET    | /storage/question_images/2rGRHaXHR2cHxGONdZp3CrStS09yAqCPF5zc7FEJ035rqsGcmQ.png | 404    | application/json |

### OPPE

- Prop keys: errors, auth, flash, banner, file_url, file_do_url, subscription_config, exam, courses
- First courses: 2:Intro to python:e9cefa4a-d8b3-4e86-ae6a-8c5129fb116f
- First question keys: id, exam_id, question_paper_id, question_number, question_text_1, question_image_1, question_type, total_mark, mark_percentage, value_start, value_end, created_at, updated_at, question_num_long, answer_type, response_type, have_answers, hash, course_id, source, is_markdown, question_text_2, question_image_2, question_image_3, question_image_4, question_image_5, question_image_6, question_image_7, question_image_8, question_image_9, question_image_10, question_images_json, parent_question_id, question_text_3, question_text_4, question_text_5, question_texts_json, uuid, solutions_count, comments_count, question_image_url, question_texts, course, options, parent_question
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
