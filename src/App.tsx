import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Outlet,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./contexts/ThemeProvider";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./components/Shared/ProtectedRoute";
import PublicRoute from "./components/Shared/PublicRoute";

import LandingPage from "./components/Public/Landing/LandingPage";
import AboutPage from "./components/Public/AboutPage";
import FAQPage from "./components/Public/FAQPage";
import ContactPage from "./components/Public/ContactPage";
import TermsPage from "./components/Public/TermsPage";
import PrivacyPolicyPage from "./components/Public/PrivacyPolicyPage";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import NotFound from "./pages/NotFound";
import RoleAssignment from "./components/Auth/RoleAssignment";
import StudentDashboard from "./components/Auth/Student/student-dashboard";
import ProfessorDashboard from "./components/Auth/Professor/professor-dashboard";
import QuestionTypeSelection from "./components/Auth/Professor/Quiz/quiz-type-selection";
import AddQuestion from "./components/Auth/Professor/Quiz/question-add";
import CustomizeQuiz from "./components/Auth/Professor/Quiz/quiz-customize";
import QuizGenerate from "./components/Auth/Professor/Quiz/quiz-generate";
import MaxQuestionsSelector from "./components/Auth/Professor/Quiz/quiz-questions-selector";
import QuizEditQuestion from "./components/Auth/Professor/Quiz/question-edit";
import EmailVerification from "./components/Auth/EmailVerification";

import ProfessorGameLobby from "./components/Auth/Professor/quiz_room/room";
import SGameLobby from "./components/Auth/Student/quiz_room/room";
import ScheduledQuizRoute from "./components/Auth/Student/scheduled_room/scheduled-route";
import Responses from "./components/Auth/Professor/scheduled_room/responses";
import ProfileSettings from "./components/Auth/ProfileSettings";

// Define route configurations
const publicRoutes = [
  { path: "/", element: <LandingPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/faq", element: <FAQPage /> },
  { path: "/contact", element: <ContactPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/privacy", element: <PrivacyPolicyPage /> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/email-verification", element: <EmailVerification /> },
];

const professorRoutes = [
  { path: "/professor/dashboard", element: <ProfessorDashboard /> },
  { path: "/professor/quiz/:quizId/generate-quiz", element: <QuizGenerate /> },
  {
    path: "/professor/quiz/:quizId/type-selection",
    element: <QuestionTypeSelection />,
  },
  {
    path: "/professor/quiz/:quizId/:type/max-questions-selector",
    element: <MaxQuestionsSelector />,
  },
  { path: "/professor/quiz/:quizId/customize", element: <CustomizeQuiz /> },
  {
    path: "/professor/quiz/:quizId/question/:questionId/edit",
    element: <QuizEditQuestion />,
  },
  {
    path: "/professor/quiz/:quizId/add-question/:type",
    element: <AddQuestion />,
  },
  {
    path: "/professor/dashboard/professor/class/:classId/gamelobby",
    element: <ProfessorGameLobby />,
  },
  {
    path: "/professor/dashboard/professor/class/:classId/responses",
    element: <Responses />,
  },
  { path: "/professor/profile", element: <ProfileSettings /> },
];

const studentRoutes = [
  { path: "/student/dashboard", element: <StudentDashboard /> },

  {
    path: "/student/join/:classId/gamelobby",
    element: <SGameLobby />,
  },
  {
    path: "/student/join/:classId/scheduled",
    element: <ScheduledQuizRoute />,
  },
  { path: "/student/profile", element: <ProfileSettings /> },
];

const App: React.FC = () => {
  return (
    <>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Public Routes */}
              {publicRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<PublicRoute>{route.element}</PublicRoute>}
                />
              ))}

              {/* Role Assignment Route */}
              <Route
                path="/role-assignment"
                element={
                  <ProtectedRoute>
                    <RoleAssignment />
                  </ProtectedRoute>
                }
              />

              {/* Professor Protected Routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["professor"]}>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                {professorRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={route.element}
                  />
                ))}
              </Route>

              {/* Student Protected Routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={["student"]}>
                    <Outlet />
                  </ProtectedRoute>
                }
              >
                {studentRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={route.element}
                  />
                ))}
              </Route>

              {/* Catch-all Route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>

      <Toaster
        position="bottom-right"
        gutter={16}
        containerStyle={{
          margin: "16px",
        }}
        toastOptions={{
          // Success variant - Green with celebration
          success: {
            duration: 4000,
            style: {
              background: "#4ade80",
              color: "#000",
              fontWeight: "700",
              border: "4px solid #000",
              borderRadius: "0",
              boxShadow: "6px 6px 0 #000",
            },
            icon: "🎉",
          },
          // Error variant - Red with warning
          error: {
            duration: 5000,
            style: {
              background: "#f87171",
              color: "#000",
              fontWeight: "700",
              border: "4px solid #000",
              borderRadius: "0",
              boxShadow: "6px 6px 0 #000",
            },
            icon: "⚠️",
          },
          // Default/Info variant - Blue
          style: {
            background: "#60a5fa",
            color: "#000",
            fontSize: "16px",
            fontWeight: "700",
            maxWidth: "500px",
            padding: "16px 24px",
            border: "4px solid #000",
            borderRadius: "0",
            boxShadow: "6px 6px 0 #000",
            fontFamily: "'Press Start 2P', cursive",
            imageRendering: "pixelated",
          },
          // Default icon
          icon: "💡",
        }}
      />
    </>
  );
};

export default App;
