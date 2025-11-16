-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.quiz (
  class_code uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  title text,
  description text,
  max_items bigint,
  total_points bigint,
  question_type text,
  created_at timestamp with time zone DEFAULT now(),
  quiz_id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  status text,
  subject text,
  cover_image text,
  open_time timestamp with time zone,
  close_time timestamp with time zone,
  retake boolean,
  shuffle boolean,
  no_time boolean,
  CONSTRAINT quiz_pkey PRIMARY KEY (quiz_id)
);
CREATE TABLE public.quiz_questions (
  quiz_id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  right_answer text NOT NULL,
  image_url text,
  quiz_question_id uuid NOT NULL DEFAULT gen_random_uuid(),
  time bigint DEFAULT '30'::bigint,
  distractor ARRAY,
  points real,
  question_type text,
  order integer,
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (quiz_question_id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quiz(quiz_id)
);
CREATE TABLE public.quiz_student_answers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  quiz_student_id uuid,
  quiz_id uuid,
  quiz_question_id uuid,
  student_answer text,
  is_correct boolean DEFAULT false,
  time_taken bigint DEFAULT 0,
  answered_at timestamp without time zone DEFAULT now(),
  CONSTRAINT quiz_student_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_student_answers_quiz_student_id_fkey FOREIGN KEY (quiz_student_id) REFERENCES public.quiz_students(id),
  CONSTRAINT quiz_student_answers_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quiz(quiz_id),
  CONSTRAINT quiz_student_answers_quiz_question_id_fkey FOREIGN KEY (quiz_question_id) REFERENCES public.quiz_questions(quiz_question_id)
);
CREATE TABLE public.quiz_students (
  quiz_student_id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_code uuid NOT NULL DEFAULT gen_random_uuid(),
  score bigint DEFAULT '0'::bigint,
  right_answer bigint DEFAULT '0'::bigint,
  wrong_answer bigint DEFAULT '0'::bigint,
  placement bigint DEFAULT '0'::bigint,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_name text NOT NULL DEFAULT '""'::text,
  student_avatar text,
  student_email text,
  quiz_taken boolean,
  CONSTRAINT quiz_students_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_students_class_code_fkey FOREIGN KEY (class_code) REFERENCES public.quiz(class_code)
);
CREATE TABLE public.temp_room (
  quiz_student_id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_code uuid NOT NULL DEFAULT gen_random_uuid(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_name text NOT NULL DEFAULT '""'::text,
  student_avatar text,
  student_email text,
  CONSTRAINT temp_room_pkey PRIMARY KEY (id)
);
CREATE TABLE public.temp_room_questions (
  class_code uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL,
  image_url text,
  quiz_question_id uuid NOT NULL DEFAULT gen_random_uuid(),
  time bigint DEFAULT '30'::bigint,
  distractor ARRAY,
  points real,
  question_type text,
  order integer,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  CONSTRAINT temp_room_questions_pkey PRIMARY KEY (id),
  CONSTRAINT temp_room_questions_class_code_fkey FOREIGN KEY (class_code) REFERENCES public.quiz(class_code)
);
CREATE TABLE public.user (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_id uuid DEFAULT auth.uid(),
  email text,
  role character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text,
  avatar_url text,
  school text,
  CONSTRAINT user_pkey PRIMARY KEY (id),
  CONSTRAINT user_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);