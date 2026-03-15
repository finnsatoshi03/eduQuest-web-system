// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/index.css";
import { AuthContextProvider } from "./contexts/AuthProvider.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QuizProvider } from "./contexts/QuizProvider.tsx";
import { QuestionEditProvider } from "./contexts/QuestionProvider.tsx";
import { GameProvider } from "./contexts/GameProvider.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    <AuthContextProvider>
      <QuestionEditProvider>
        <QuizProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </QuizProvider>
      </QuestionEditProvider>
    </AuthContextProvider>
  </QueryClientProvider>,
);
