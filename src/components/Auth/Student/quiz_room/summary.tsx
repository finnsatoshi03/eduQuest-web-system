import React from "react";
import { motion } from "framer-motion";
import { Computer, Medal, Stars, X } from "lucide-react";
import ClassAccuracy from "../../Professor/quiz_room/class-accuracy";

interface SummaryProps {
  score: number;
  rightAns: number;
  wrongAns: number;
  totalParticipants?: number;
  totalQuestions: number;
  accuracy: number;
  rank?: number;
  questions: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
  }[];
  onFinish: () => void;
  isScheduledQuiz?: boolean;
  isResultsPending?: boolean;
}

interface AccuracySectionProps {
  accuracy: number;
  rank?: number;
  totalParticipants?: number;
  score: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
}

interface PerformanceStatsProps {
  rightAns: number;
  wrongAns: number;
  totalQuestions: number;
}

interface StatItemProps {
  value: number;
  label: string;
  icon: string;
  bgColor: string;
}

interface Question {
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

interface QuestionReviewProps {
  questions: Question[];
}

interface QuestionItemProps {
  question: Question;
}

const Summary: React.FC<SummaryProps> = ({
  score,
  rightAns,
  wrongAns,
  totalParticipants,
  totalQuestions,
  accuracy,
  rank,
  questions,
  onFinish,
  isScheduledQuiz = false,
  isResultsPending = false,
}) => {
  const getAnalysis = () => {
    const percentage = (score / totalQuestions) * 100;
    if (percentage >= 90)
      return "Excellent job! You've mastered this topic. Keep up the great work!";
    if (percentage >= 80)
      return "Great performance! You have a solid understanding of the subject. A little more practice and you'll be an expert!";
    if (percentage >= 70)
      return "Good effort! You're on the right track. Focus on the areas you missed to improve your score.";
    if (percentage >= 60)
      return "Not bad! You're making progress. Review the questions you got wrong and try again to boost your score.";
    return "Keep practicing! Don't get discouraged. Review the material and try the quiz again. You'll improve with each attempt!";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative my-16 flex w-full items-center justify-center"
    >
      <motion.button
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        className="fixed top-6 left-6 z-10 rounded-md bg-slate-500 bg-opacity-10 p-1.5 hover:bg-opacity-20"
        onClick={onFinish}
      >
        <X />
      </motion.button>
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl rounded-md bg-slate-500 bg-opacity-50 p-4 text-center"
      >
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold md:text-4xl"
        >
          Game Summary
        </motion.h1>
        <motion.p
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mx-auto my-2 flex w-fit items-center gap-1 rounded bg-slate-400 bg-opacity-50 px-2 py-1 text-xs"
        >
          <Computer size={16} /> {isScheduledQuiz ? "Scheduled Quiz" : "Live Quiz"}
        </motion.p>
        {isResultsPending && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mx-auto my-4 flex w-fit items-center gap-2 rounded-lg bg-yellow-500 bg-opacity-90 px-4 py-2 text-sm font-semibold text-yellow-900"
          >
            <span className="animate-pulse">⏳</span>
            Results Pending - Your answers have been submitted. Final results will be available once the professor finalizes the quiz.
          </motion.div>
        )}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-base font-bold md:text-lg"
        >
          {getAnalysis()}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-8 space-y-8"
        >
          <AccuracySection
            accuracy={accuracy}
            rank={rank}
            totalParticipants={totalParticipants}
            score={score}
          />
          <PerformanceStats
            rightAns={rightAns}
            wrongAns={wrongAns}
            totalQuestions={totalQuestions}
          />
          <QuestionReview questions={questions} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

const AccuracySection: React.FC<AccuracySectionProps> = ({
  accuracy,
  rank,
  totalParticipants,
  score,
}) => (
  <motion.div
    initial={{ x: -50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="space-y-2"
  >
    <div className="rounded-xl bg-slate-700 px-4 py-2">
      <p className="mb-2 text-left text-sm text-white">Accuracy</p>
      <ClassAccuracy
        accuracy={accuracy}
        height={6}
        bgColor="bg-white"
        noHeader
      />
    </div>
    <div
      className={`grid ${rank ? "grid-cols-2" : "grid-cols-1"} gap-2 text-left`}
    >
      {rank && (
        <StatCard
          title="Rank"
          value={`${rank}/${totalParticipants}`}
          icon={<Medal />}
          bgColor="bg-purple-700"
        />
      )}
      <StatCard
        title="Score"
        value={score}
        icon={<Stars className="fill-white" />}
        bgColor="bg-green-700"
      />
    </div>
  </motion.div>
);

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, bgColor }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="flex items-center justify-between rounded-xl bg-slate-700 px-4 py-2 text-white"
  >
    <div>
      <p className="text-xs">{title}</p>
      <p className="font-bold">{value}</p>
    </div>
    <div className={`rounded-lg ${bgColor} p-1`}>{icon}</div>
  </motion.div>
);

const PerformanceStats: React.FC<PerformanceStatsProps> = ({
  rightAns,
  wrongAns,
  totalQuestions,
}) => (
  <motion.div
    initial={{ x: 50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ duration: 0.5, delay: 0.2 }}
  >
    <h2 className="mb-2">Performance Stats</h2>
    <div className="grid grid-cols-3 gap-2">
      <StatItem
        value={rightAns}
        label="Correct"
        icon="✓"
        bgColor="bg-green-500"
      />
      <StatItem
        value={wrongAns}
        label="Incorrect"
        icon="×"
        bgColor="bg-red-500"
      />
      <StatItem
        value={totalQuestions}
        label="Total Questions"
        icon="?"
        bgColor="bg-yellow-500"
      />
    </div>
  </motion.div>
);

const StatItem: React.FC<StatItemProps> = ({ value, label, icon, bgColor }) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="relative flex items-center justify-center overflow-hidden rounded-xl bg-slate-700 px-4 py-2 text-white"
  >
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
    <div
      className={`absolute -bottom-2 -left-2 flex size-16 -rotate-12 items-center justify-center rounded-full ${bgColor} p-3 opacity-40`}
    >
      <span className="mb-3 text-[40px] font-black text-slate-700">{icon}</span>
    </div>
  </motion.div>
);

const QuestionReview: React.FC<QuestionReviewProps> = ({ questions }) => (
  <motion.div
    initial={{ y: 50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5, delay: 0.4 }}
    className="mb-8 rounded-xl bg-slate-700 p-6 text-left text-white"
  >
    <h2 className="mb-2 text-lg font-bold">Detailed Question Review</h2>
    <p className="mb-4 text-sm">
      Review the questions and your answers below to understand your
      performance.
    </p>
    {questions.map((q, index) => (
      <QuestionItem key={index} question={q} index={index} />
    ))}
  </motion.div>
);

const QuestionItem: React.FC<QuestionItemProps & { index: number }> = ({
  question,
  index,
}) => {
  const isCorrect = question.userAnswer === question.correctAnswer;
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 * index }}
      className="relative mb-4 rounded-xl bg-zinc-100 p-4 text-black shadow"
    >
      <div
        className={`absolute left-0 top-0 h-full w-2 rounded-l-xl ${
          isCorrect ? "bg-green-600" : "bg-red-600"
        }`}
      ></div>
      <div className="ml-4">
        <div className="mb-2 font-semibold">Q: {question.question}</div>
        <div className="text-sm">
          Your answer:{" "}
          <span className={isCorrect ? "text-green-600" : "text-red-600"}>
            {question.userAnswer}
          </span>
        </div>
        {!isCorrect && (
          <div className="text-sm">
            Correct answer:{" "}
            <span className="text-green-600">{question.correctAnswer}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Summary;
