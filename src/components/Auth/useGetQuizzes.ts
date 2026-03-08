import { useAuth } from "@/contexts/AuthProvider";
import { getQuizzesByOwnerId } from "@/services/api/apiQuiz";
import { useQuery } from "@tanstack/react-query";

export function useGetQuizzes() {
  const { user } = useAuth();
  const ownerId = user ? user.id : null;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["quizzes", ownerId],
    queryFn: async () => {
      const data = await getQuizzesByOwnerId(ownerId!);
            
      if (!data) {
        throw new Error("Quiz not found");
      }
      return data;
    },
    enabled: !!ownerId,
  });

  return { quizzes: data, isPending, isError, refetch };
}
