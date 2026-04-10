/**
 * IITM BS Course Level Mapping
 * 
 * Maps course names/codes to their official level in the IITM BS Data Science program.
 * Based on official curriculum from study.iitm.ac.in
 * 
 * Levels:
 * - Foundation: 8 courses (32 credits)
 * - Diploma in Programming: 6 courses + 2 projects (27 credits)
 * - Diploma in Data Science: 6 courses + 2 projects (27 credits)
 * - Degree: Core + Electives (56 credits for BSc + BS)
 */

export type CourseLevel = 
  | 'Foundation'
  | 'Diploma in Programming'
  | 'Diploma in Data Science'
  | 'Degree'
  | 'Other';

// Display order for levels
export const LEVEL_ORDER: CourseLevel[] = [
  'Foundation',
  'Diploma in Programming',
  'Diploma in Data Science',
  'Degree',
  'Other',
];

// Normalize course name for matching (lowercase, remove spaces/special chars)
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_]/g, '');
}

// Course name variations mapped to canonical names
const NAME_NORMALIZATIONS: Record<string, string> = {
  // Foundation - Mathematics
  'maths1': 'Mathematics for Data Science I',
  'maths 1': 'Mathematics for Data Science I',
  'math1': 'Mathematics for Data Science I',
  'mathematics1': 'Mathematics for Data Science I',
  'mathematicsfordatascience1': 'Mathematics for Data Science I',
  'mathematicsfordatasciencei': 'Mathematics for Data Science I',
  'maths2': 'Mathematics for Data Science II',
  'maths 2': 'Mathematics for Data Science II',
  'math2': 'Mathematics for Data Science II',
  'mathematics2': 'Mathematics for Data Science II',
  'mathematicsfordatascience2': 'Mathematics for Data Science II',
  'mathematicsfordatascienceii': 'Mathematics for Data Science II',
  
  // Foundation - Statistics
  'statistics1': 'Statistics for Data Science I',
  'stats1': 'Statistics for Data Science I',
  'stats-1': 'Statistics for Data Science I',
  'statisticsfordatascience1': 'Statistics for Data Science I',
  'statisticsfordatasciencei': 'Statistics for Data Science I',
  'statistics2': 'Statistics for Data Science II',
  'stats2': 'Statistics for Data Science II',
  'statisticsfordatascience2': 'Statistics for Data Science II',
  'statisticsfordatascienceii': 'Statistics for Data Science II',
  
  // Foundation - Programming
  'ct': 'Computational Thinking',
  'computationalthinking': 'Computational Thinking',
  'introtopython': 'Programming in Python',
  'intro to python': 'Programming in Python',
  'programminginpython': 'Programming in Python',
  'python': 'Programming in Python',
  'pythonprogramming': 'Programming in Python',
  'pythonprogramming-es': 'Programming in Python',
  
  // Foundation - English
  'english1': 'English I',
  'english 1': 'English I',
  'englishi': 'English I',
  'englishi-es': 'English I',
  'esenglish1': 'English I',
  'es english1': 'English I',
  'english2': 'English II',
  'english 2': 'English II',
  'englishii': 'English II',
  'esenglish2': 'English II',
  'es english2': 'English II',
  
  // Diploma in Programming
  'dbms': 'Database Management Systems',
  'databasemanagementsystems': 'Database Management Systems',
  'pdsa': 'Programming, Data Structures and Algorithms',
  'programmingdatastructuresandalgorithms': 'Programming, Data Structures and Algorithms',
  'appdev1': 'Modern Application Development I',
  'applicationdevelopment1': 'Modern Application Development I',
  'modernapplicationdevelopment1': 'Modern Application Development I',
  'modernapplicationdevelopmenti': 'Modern Application Development I',
  'appdev2': 'Modern Application Development II',
  'applicationdevelopment2': 'Modern Application Development II',
  'modernapplicationdevelopment2': 'Modern Application Development II',
  'modernapplicationdevelopmentii': 'Modern Application Development II',
  'java': 'Programming Concepts using Java',
  'javaprogramming': 'Programming Concepts using Java',
  'programmingconceptsusingjava': 'Programming Concepts using Java',
  'systemcommands': 'System Commands',
  'system commands': 'System Commands',
  
  // Diploma in Data Science
  'mlf': 'Machine Learning Foundations',
  'machinelearningfoundations': 'Machine Learning Foundations',
  'mlt': 'Machine Learning Techniques',
  'machinelearningtechniques': 'Machine Learning Techniques',
  'mlp': 'Machine Learning Practice',
  'machinelearningpractice': 'Machine Learning Practice',
  'bdm': 'Business Data Management',
  'businessdatamanagement': 'Business Data Management',
  'ba': 'Business Analytics',
  'businessanalytics': 'Business Analytics',
  'tds': 'Tools in Data Science',
  'toolsindatascience': 'Tools in Data Science',
  'dlgenai': 'Introduction to Deep Learning and Generative AI',
  'deeplearningandgenerativeai': 'Introduction to Deep Learning and Generative AI',
  'introductiontodeeplearningandgenerativeai': 'Introduction to Deep Learning and Generative AI',
  
  // Degree - Core
  'swengg': 'Software Engineering',
  'sw engg': 'Software Engineering',
  'softwareengineering': 'Software Engineering',
  'swtesting': 'Software Testing',
  'sw testing': 'Software Testing',
  'softwaretesting': 'Software Testing',
  'ai': 'AI: Search Methods for Problem Solving',
  'aisearchmethods': 'AI: Search Methods for Problem Solving',
  'deeplearning': 'Deep Learning',
  'dl': 'Deep Learning',
  'spg': 'Strategies for Professional Growth',
  'strategiesforprofessionalgrowth': 'Strategies for Professional Growth',
  
  // Degree - Electives
  'advancedalgorithms': 'Advanced Algorithms',
  'algorithmicthinking': 'Algorithmic Thinking',
  'algorithmicthinkingbio': 'Algorithmic Thinking in Bioinformatics',
  'algorithmicthinkinginbioinformatics': 'Algorithmic Thinking in Bioinformatics',
  'algothinking': 'Algorithmic Thinking',
  'bbn': 'Big Data and Biological Networks',
  'bdbn': 'Big Data and Biological Networks',
  'bigdataandbiologicalnetworks': 'Big Data and Biological Networks',
  'dataviz': 'Data Visualization Design',
  'datavisualization': 'Data Visualization Design',
  'datavisualizationdesign': 'Data Visualization Design',
  'dvd': 'Data Visualization Design',
  'rl': 'Reinforcement Learning',
  'reinforcementlearning': 'Reinforcement Learning',
  'speechtech': 'Speech Technology',
  'speechtechnology': 'Speech Technology',
  'industry4.0': 'Industry 4.0',
  'industry40': 'Industry 4.0',
  'marketresearch': 'Market Research',
  'finforensics': 'Financial Forensics',
  'financialforensics': 'Financial Forensics',
  'fin forensics': 'Financial Forensics',
  'lsm': 'Linear Statistical Models',
  'linearstatisticalmodels': 'Linear Statistical Models',
  'statcomputing': 'Statistical Computing',
  'statisticalcomputing': 'Statistical Computing',
  'stat computing': 'Statistical Computing',
  'csd': 'Computer Systems Design',
  'computersystemdesign': 'Computer Systems Design',
  'computersystemdesigns': 'Computer Systems Design',
  'computer system design': 'Computer Systems Design',
  'computer system designs': 'Computer Systems Design',
  'programminginc': 'Programming in C',
  'introcprogramming': 'Programming in C',
  'intro c programming': 'Programming in C',
  'introduction to c programming': 'Programming in C',
  'intro to c programming': 'Programming in C',
  'mathematicalthinking': 'Mathematical Thinking',
  'llm': 'Large Language Models',
  'largelanguagemodels': 'Large Language Models',
  'inlp': 'Introduction to Natural Language Processing',
  'i-nlp': 'Introduction to Natural Language Processing',
  'nlp': 'Introduction to Natural Language Processing',
  'dlcv': 'Deep Learning for Computer Vision',
  'dl(cv)': 'Deep Learning for Computer Vision',
  'deeplearningforcomputervision': 'Deep Learning for Computer Vision',
  'managerialeconomics': 'Managerial Economics',
  'gametheory': 'Game Theory and Strategy',
  'gametheoryandstrategy': 'Game Theory and Strategy',
  'corporatefinance': 'Corporate Finance',
  'dlp': 'Deep Learning Practice',
  'deeplearningpractice': 'Deep Learning Practice',
  'os': 'Operating Systems',
  'operatingsystems': 'Operating Systems',
  'mathfoundationsgenai': 'Mathematical Foundations of Generative AI',
  'mathematicalfoundationsofgenerativeai': 'Mathematical Foundations of Generative AI',
  'computernetworks': 'Computer Networks',
  'computer networks': 'Computer Networks',
  'psm': 'Privacy & Security in Online Social Media',
  'psosm': 'Privacy & Security in Online Social Media',
  
  // Electronics stream (categorized as Other for DS focus)
  'aes': 'Applied Electronics',
  'digitalsystems': 'Digital Systems',
  'dsd': 'Digital System Design',
  'dsp': 'Digital Signal Processing',
  'fpga': 'FPGA Design',
  'signalsandsystems': 'Signals and Systems',
  'signals and systems': 'Signals and Systems',
  'sensorsandapplication': 'Sensors and Applications',
  'sensors and application': 'Sensors and Applications',
  'embeddedcprogramming': 'Embedded C Programming',
  'embedded c programming': 'Embedded C Programming',
  'controlengineering': 'Control Engineering',
  'mathforelectronicsi': 'Math for Electronics I',
  'math for electronics i': 'Math for Electronics I',
  'mathforelectronicsii': 'Math for Electronics II',
  'math for electronics ii': 'Math for Electronics II',
  'introlinux': 'Introduction to Linux',
  'intro to linux': 'Introduction to Linux',
  'introtothelinuxshell': 'Introduction to Linux',
  'intro to the linux shell': 'Introduction to Linux',
  'eec': 'Electronics Elective',
  'eftl': 'Electronics Elective',
  'epd': 'Electronics Elective',
  'estc': 'Electronics Elective',
  'etm': 'Electronics Elective',
  'sdvl': 'Electronics Elective',
};

// Canonical course name to level mapping
const COURSE_LEVELS: Record<string, CourseLevel> = {
  // Foundation Level (8 courses)
  'Mathematics for Data Science I': 'Foundation',
  'Mathematics for Data Science II': 'Foundation',
  'Statistics for Data Science I': 'Foundation',
  'Statistics for Data Science II': 'Foundation',
  'Computational Thinking': 'Foundation',
  'Programming in Python': 'Foundation',
  'English I': 'Foundation',
  'English II': 'Foundation',
  
  // Diploma in Programming (6 courses + 2 projects)
  'Database Management Systems': 'Diploma in Programming',
  'Programming, Data Structures and Algorithms': 'Diploma in Programming',
  'Modern Application Development I': 'Diploma in Programming',
  'Modern Application Development II': 'Diploma in Programming',
  'Programming Concepts using Java': 'Diploma in Programming',
  'System Commands': 'Diploma in Programming',
  
  // Diploma in Data Science (6 courses + 2 projects)
  'Machine Learning Foundations': 'Diploma in Data Science',
  'Machine Learning Techniques': 'Diploma in Data Science',
  'Machine Learning Practice': 'Diploma in Data Science',
  'Business Data Management': 'Diploma in Data Science',
  'Business Analytics': 'Diploma in Data Science',
  'Tools in Data Science': 'Diploma in Data Science',
  'Introduction to Deep Learning and Generative AI': 'Diploma in Data Science',
  
  // Degree Level - Core
  'Software Engineering': 'Degree',
  'Software Testing': 'Degree',
  'AI: Search Methods for Problem Solving': 'Degree',
  'Deep Learning': 'Degree',
  'Strategies for Professional Growth': 'Degree',
  
  // Degree Level - Electives
  'Advanced Algorithms': 'Degree',
  'Algorithmic Thinking': 'Degree',
  'Algorithmic Thinking in Bioinformatics': 'Degree',
  'Big Data and Biological Networks': 'Degree',
  'Data Visualization Design': 'Degree',
  'Reinforcement Learning': 'Degree',
  'Speech Technology': 'Degree',
  'Industry 4.0': 'Degree',
  'Market Research': 'Degree',
  'Financial Forensics': 'Degree',
  'Linear Statistical Models': 'Degree',
  'Statistical Computing': 'Degree',
  'Computer Systems Design': 'Degree',
  'Programming in C': 'Degree',
  'Mathematical Thinking': 'Degree',
  'Large Language Models': 'Degree',
  'Introduction to Natural Language Processing': 'Degree',
  'Deep Learning for Computer Vision': 'Degree',
  'Managerial Economics': 'Degree',
  'Game Theory and Strategy': 'Degree',
  'Corporate Finance': 'Degree',
  'Deep Learning Practice': 'Degree',
  'Operating Systems': 'Degree',
  'Mathematical Foundations of Generative AI': 'Degree',
  'Computer Networks': 'Degree',
  'Privacy & Security in Online Social Media': 'Degree',
  
  // Electronics (Other)
  'Applied Electronics': 'Other',
  'Digital Systems': 'Other',
  'Digital System Design': 'Other',
  'Digital Signal Processing': 'Other',
  'FPGA Design': 'Other',
  'Signals and Systems': 'Other',
  'Sensors and Applications': 'Other',
  'Embedded C Programming': 'Other',
  'Control Engineering': 'Other',
  'Math for Electronics I': 'Other',
  'Math for Electronics II': 'Other',
  'Introduction to Linux': 'Other',
  'Electronics Elective': 'Other',
};

/**
 * Get the canonical display name for a course
 */
export function getCanonicalCourseName(courseName: string): string {
  const normalized = normalizeName(courseName);
  return NAME_NORMALIZATIONS[normalized] || NAME_NORMALIZATIONS[courseName.toLowerCase()] || courseName;
}

/**
 * Get the level for a course by name or code
 */
export function getCourseLevel(courseName: string): CourseLevel {
  const canonical = getCanonicalCourseName(courseName);
  return COURSE_LEVELS[canonical] || 'Other';
}

/**
 * Get display name for a course (normalized, clean)
 */
export function getDisplayCourseName(courseName: string): string {
  const canonical = getCanonicalCourseName(courseName);
  // If we found a canonical name, use it; otherwise clean up the original
  if (canonical !== courseName) {
    return canonical;
  }
  // Basic cleanup for unknown courses
  return courseName
    .replace(/([a-z])(\d)/gi, '$1 $2') // Add space before numbers
    .replace(/(\d)([a-z])/gi, '$1 $2') // Add space after numbers
    .trim();
}

/**
 * Group courses by level
 */
export function groupCoursesByLevel<T extends { courseName: string }>(
  courses: T[]
): Record<CourseLevel, T[]> {
  const grouped: Record<CourseLevel, T[]> = {
    'Foundation': [],
    'Diploma in Programming': [],
    'Diploma in Data Science': [],
    'Degree': [],
    'Other': [],
  };
  
  for (const course of courses) {
    const level = getCourseLevel(course.courseName);
    grouped[level].push(course);
  }
  
  return grouped;
}

/**
 * Get level description for UI
 */
export function getLevelDescription(level: CourseLevel): string {
  switch (level) {
    case 'Foundation':
      return '8 courses • Mathematics, Statistics, Programming, English';
    case 'Diploma in Programming':
      return '6 courses • Databases, Algorithms, App Development';
    case 'Diploma in Data Science':
      return '6 courses • Machine Learning, Data Management, Analytics';
    case 'Degree':
      return 'Core + Electives • Advanced topics and specializations';
    case 'Other':
      return 'Additional courses';
  }
}

/**
 * Get level color for UI styling
 */
export function getLevelColor(level: CourseLevel): string {
  switch (level) {
    case 'Foundation':
      return 'text-blue-400';
    case 'Diploma in Programming':
      return 'text-purple-400';
    case 'Diploma in Data Science':
      return 'text-orange-400';
    case 'Degree':
      return 'text-emerald-400';
    case 'Other':
      return 'text-gray-400';
  }
}

/**
 * Deduplicated course with merged data from multiple source entries
 */
export interface DeduplicatedCourse {
  displayName: string;
  uuids: string[];
  primaryUuid: string;
  paperCount: number;
  level: CourseLevel;
  originalNames: string[];
}

/**
 * Deduplicate courses by their canonical display name.
 * Merges paper counts and keeps track of all source UUIDs.
 */
export function deduplicateCourses<T extends { uuid: string; courseName: string; paperCount: number }>(
  courses: T[]
): DeduplicatedCourse[] {
  const mergedMap = new Map<string, DeduplicatedCourse>();

  for (const course of courses) {
    const displayName = getDisplayCourseName(course.courseName);
    const level = getCourseLevel(course.courseName);

    const existing = mergedMap.get(displayName);
    if (existing) {
      existing.uuids.push(course.uuid);
      existing.paperCount += course.paperCount;
      if (!existing.originalNames.includes(course.courseName)) {
        existing.originalNames.push(course.courseName);
      }
    } else {
      mergedMap.set(displayName, {
        displayName,
        uuids: [course.uuid],
        primaryUuid: course.uuid,
        paperCount: course.paperCount,
        level,
        originalNames: [course.courseName],
      });
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

/**
 * Group deduplicated courses by level
 */
export function groupDeduplicatedCoursesByLevel(
  courses: DeduplicatedCourse[]
): Record<CourseLevel, DeduplicatedCourse[]> {
  const grouped: Record<CourseLevel, DeduplicatedCourse[]> = {
    'Foundation': [],
    'Diploma in Programming': [],
    'Diploma in Data Science': [],
    'Degree': [],
    'Other': [],
  };

  for (const course of courses) {
    grouped[course.level].push(course);
  }

  return grouped;
}
