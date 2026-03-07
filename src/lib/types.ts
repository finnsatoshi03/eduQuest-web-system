export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: "professor" | "student" | null;
  school?: string;
}

export interface Student {
  placement: number;
  quiz_student_id: string;
  right_answer: number;
  score: number;
  student_name: string;
  student_avatar: string;
  student_email: string;
  wrong_answer: number;
}

export interface Quiz {
  class_code: string;
  quiz_id: string;
  title: string;
  description: string;
  subject: string;
  max_items: number;
  total_points: number;
  question_type: string;
  owner_id: string;
  created_at: string;
  status: string;
  cover_image: string;
  quiz_questions?: QuizQuestions[];
  open_time?: string;
  close_time?: string;
  no_time?: boolean;
  retake?: boolean;
  shuffle?: boolean;
}

export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuizQuestions {
  quiz_question_id: string;
  quiz_id: string;
  right_answer: string;
  question: string;
  distractor?: string[];
  time: number;
  image_url?: string;
  points?: number;
  question_type: string;
  order: number;
  difficulty?: QuestionDifficulty;
}

export interface LeaderboardEntry {
  quiz_student_id: string;
  score: number;
  id: string;
  right_answer: number;
  wrong_answer: number;
  student_name: string;
  student_avatar: string;
  student_email: string;
}

export interface TempQuizQuestionPayload {
  quiz_question_id: string;
  class_code: string;
  question: string;
  distractor: string;
  time: number;
  image_url: string;
  points: number;
  question_type: string;
  order: number;
  difficulty?: QuestionDifficulty;
  start_time: string;
  end_time: string;
}

interface UserMetadata {
  name?: string;
  role?: string | null;
  school?: string;
  avatar?: string;
  picture?: string;
}

interface SessionUser {
  id: string;
  email: string | null;
  user_metadata: UserMetadata;
}

export interface Session {
  user: SessionUser;
}

export enum Subject {
  Math = "Math",
  English = "English",
  WorldLanguages = "World Languages",
  Science = "Science",
  Physics = "Physics",
  Chemistry = "Chemistry",
  Biology = "Biology",
  SocialStudies = "Social Studies",
  Geography = "Geography",
  History = "History",
  Arts = "Arts",
  Computers = "Computers",
  PhysicalEd = "Physical Education",
  Fun = "Fun",
  PersonalDev = "Personal Development",
  Architecture = "Architecture",
  Business = "Business",
  Design = "Design",
  Education = "Education",
  InstructionalTech = "Instructional Technology",
  Journalism = "Journalism",
  LifeSkills = "Life Skills",
  MoralScience = "Moral Science",

  // Grade School Subjects
  Filipino = "Filipino",
  Music = "Music",
  Health = "Health",
  HomeEconomics = "Home Economics",
  ValuesEducation = "Values Education",
  CharacterEducation = "Character Education",

  // High School Subjects
  Algebra = "Algebra",
  Geometry = "Geometry",
  Trigonometry = "Trigonometry",
  Calculus = "Calculus",
  Statistics = "Statistics",
  Literature = "Literature",
  Grammar = "Grammar",
  Composition = "Composition",
  CreativeWriting = "Creative Writing",
  Speech = "Speech",
  Debate = "Debate",
  Psychology = "Psychology",
  Sociology = "Sociology",
  Anthropology = "Anthropology",
  Economics = "Economics",
  Government = "Government",
  Civics = "Civics",
  Philosophy = "Philosophy",
  Accounting = "Accounting",
  Marketing = "Marketing",
  Management = "Management",
  Entrepreneurship = "Entrepreneurship",
  ComputerScience = "Computer Science",
  Programming = "Programming",
  WebDevelopment = "Web Development",
  GraphicDesign = "Graphic Design",
  DigitalMedia = "Digital Media",
  VisualArts = "Visual Arts",
  MusicTheory = "Music Theory",
  MusicPerformance = "Music Performance",
  Dance = "Dance",
  Theater = "Theater",
  Film = "Film",
  BroadcastCommunication = "Broadcast Communication",
  PublicSpeaking = "Public Speaking",
  PersonalFinance = "Personal Finance",
  CareerGuidance = "Career Guidance",

  // College Subjects
  AdvancedMath = "Advanced Math",
  AppliedMath = "Applied Math",
  DiscreteMath = "Discrete Math",
  LinearAlgebra = "Linear Algebra",
  DifferentialEquations = "Differential Equations",
  ProbabilityAndStatistics = "Probability and Statistics",
  DataScience = "Data Science",
  MachineLearning = "Machine Learning",
  ArtificialIntelligence = "Artificial Intelligence",
  ComputerEngineering = "Computer Engineering",
  SoftwareEngineering = "Software Engineering",
  InformationTechnology = "Information Technology",
  Cybersecurity = "Cybersecurity",
  Networking = "Networking",
  DatabaseManagement = "Database Management",
  MobileAppDevelopment = "Mobile App Development",
  GameDevelopment = "Game Development",
  Animation = "Animation",
  InteriorDesign = "Interior Design",
  IndustrialDesign = "Industrial Design",
  FashionDesign = "Fashion Design",
  LandscapeArchitecture = "Landscape Architecture",
  UrbanPlanning = "Urban Planning",
  CivilEngineering = "Civil Engineering",
  MechanicalEngineering = "Mechanical Engineering",
  ElectricalEngineering = "Electrical Engineering",
  ChemicalEngineering = "Chemical Engineering",
  BiomedicalEngineering = "Biomedical Engineering",
  EnvironmentalEngineering = "Environmental Engineering",
  BusinessAdministration = "Business Administration",
  Finance = "Finance",
  HumanResources = "Human Resources",
  OperationsManagement = "Operations Management",
  TeachingMethods = "Teaching Methods",
  CurriculumDevelopment = "Curriculum Development",
  EducationalPsychology = "Educational Psychology",
  SpecialEducation = "Special Education",
  EarlyChildhoodEducation = "Early Childhood Education",
  PublicRelations = "Public Relations",
  Advertising = "Advertising",
  CommunicationStudies = "Communication Studies",
  HealthSciences = "Health Sciences",
  Nursing = "Nursing",
  Medicine = "Medicine",
  Dentistry = "Dentistry",
  Pharmacy = "Pharmacy",
  AlliedHealth = "Allied Health",
  VeterinaryMedicine = "Veterinary Medicine",
  Agriculture = "Agriculture",
  EnvironmentalScience = "Environmental Science",
  Geology = "Geology",
  Oceanography = "Oceanography",
  Astronomy = "Astronomy",
  EnvironmentalStudies = "Environmental Studies",
  Sustainability = "Sustainability",
  SocialWork = "Social Work",
  CriminalJustice = "Criminal Justice",
  Law = "Law",
  PoliticalScience = "Political Science",
  InternationalRelations = "International Relations",
  ForeignLanguages = "Foreign Languages",
  MediaStudies = "Media Studies",
  Athletics = "Athletics",
  SportsManagement = "Sports Management",
  Kinesiology = "Kinesiology",
  Nutrition = "Nutrition",
  Dietetics = "Dietetics",
  CulinaryArts = "Culinary Arts",
  HospitalityManagement = "Hospitality Management",
  Tourism = "Tourism",
  EventManagement = "Event Management",
  RealEstate = "Real Estate",
  ConstructionManagement = "Construction Management",
  ArchitectureEngineering = "Architecture Engineering",
  UrbanDesign = "Urban Design",
  PublicAdministration = "Public Administration",
  SocialPolicy = "Social Policy",
  PublicHealth = "Public Health",
  EmergencyManagement = "Emergency Management",
  DisasterPreparedness = "Disaster Preparedness",
  MilitaryScience = "Military Science",
  IntelligenceStudies = "Intelligence Studies",
  SecurityStudies = "Security Studies",

  Others = "Others",
}

export type SubjectData = {
  [key in keyof typeof Subject]: string;
};
