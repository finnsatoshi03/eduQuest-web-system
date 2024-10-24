/* eslint-disable @typescript-eslint/no-explicit-any */
import supabase from "../supabase";

export const checkEmailExists = async (
  email: string  
): Promise<any | undefined> => {
  const { data, error } = await supabase
    .from("user")
    .select("id")
    .eq("email", email)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking email:", error);
    throw new Error("Error checking email.");
  }

  return data;
};
