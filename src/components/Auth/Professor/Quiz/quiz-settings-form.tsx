/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, Loader2, Settings, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectData } from "@/lib/data";
import { Quiz, Subject } from "@/lib/types";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  transformSubjectData,
  convertLocalToUTC,
  convertUTCToLocal,
  isOvernightSchedule,
} from "@/lib/helpers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateQuizSettings } from "@/services/api/apiQuiz";
import toast from "react-hot-toast";
import { Checkbox } from "@/components/ui/checkbox";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
    subject: z.string().min(1, "Subject must be selected"),
    cover_image: z
      .instanceof(File)
      .refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
      .refine(
        (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
        "Only .jpg, .png, and .webp formats are supported.",
      )
      .optional(),
    is_scheduled: z.boolean().default(false),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
    shuffle_questions: z.boolean().default(false),
    allow_retake: z.boolean().default(false),
    no_time_limit: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.is_scheduled) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const openTime = new Date(data.open_time || "");
        const closeTime = new Date(data.close_time || "");

        if (!data.open_time || !data.close_time) {
          return false;
        }

        // Only invalidate if the open date is before today (ignoring time)
        if (openTime < today) {
          return false;
        }

        if (closeTime <= openTime) {
          return false;
        }

        return true;
      }
      return true;
    },
    {
      message:
        "When scheduled, open time cannot be in the past and close time must be after open time",
      path: ["close_time"],
    },
  );

type QuizSettingsFormProps = {
  quiz: Quiz;
  formErrors: string[];
  setFormErrors: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function QuizSettingsForm({
  quiz,
  formErrors,
  setFormErrors,
}: QuizSettingsFormProps) {
  const queryClient = useQueryClient();

  const transformedSubjectData = transformSubjectData(subjectData);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    quiz?.cover_image || null,
  );
  const [isScheduled, setIsScheduled] = useState(
    !!(quiz?.open_time && quiz?.close_time),
  );
  const [showOvernightWarning, setShowOvernightWarning] = useState(false);

  const { mutate: mutateUpdateQuiz, isPending } = useMutation({
    mutationFn: (data: any) => updateQuizSettings(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quiz.quiz_id] });
    },
    onSuccess: () => {
      toast.success("Quiz settings updated");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update quiz settings");
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      title: quiz?.title || "Untitled Quiz",
      description: quiz?.description || "",
      subject: quiz?.subject as Subject,
      cover_image: undefined,
      is_scheduled: !!(quiz?.open_time && quiz?.close_time),
      open_time: quiz?.open_time ? convertUTCToLocal(quiz.open_time) : "",
      close_time: quiz?.close_time ? convertUTCToLocal(quiz.close_time) : "",
      shuffle_questions: quiz?.shuffle || false,
      allow_retake: quiz?.retake || false,
      no_time_limit: quiz?.no_time || false,
    },
  });

  useEffect(() => {
    return () => {
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }
    };
  }, [coverImagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("cover_image", file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    form.setValue("cover_image", undefined);
    if (coverImagePreview) {
      URL.revokeObjectURL(coverImagePreview);
    }
    setCoverImagePreview(null);
  };

  useEffect(() => {
    if (formErrors.length > 0) {
      formErrors.forEach((error) => {
        if (error.includes("Title")) {
          form.setError("title", { type: "manual", message: error });
        } else if (error.includes("Description")) {
          form.setError("description", { type: "manual", message: error });
        } else if (error.includes("Subject")) {
          form.setError("subject", { type: "manual", message: error });
        }
      });
    }
  }, [formErrors, form]);

  // Clear externally injected errors as soon as the user starts fixing fields.
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (!name) return;

      if (["title", "description", "subject"].includes(name)) {
        form.clearErrors(name as "title" | "description" | "subject");
        if (formErrors.length > 0) {
          setFormErrors([]);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form, formErrors.length, setFormErrors]);

  // Check for overnight schedules
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (
        (name === "open_time" || name === "close_time") &&
        value.open_time &&
        value.close_time
      ) {
        const isOvernight = isOvernightSchedule(
          value.open_time,
          value.close_time,
        );
        setShowOvernightWarning(isOvernight);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const {
      is_scheduled,
      open_time,
      close_time,
      allow_retake,
      shuffle_questions,
      no_time_limit,
      ...restValues
    } = values;

    // Convert local times to UTC before sending to API
    const openTimeUTC = open_time ? convertLocalToUTC(open_time) : null;
    const closeTimeUTC = close_time ? convertLocalToUTC(close_time) : null;

    const submittedValues = {
      quizId: quiz.quiz_id,
      ...restValues,
      open_time: openTimeUTC,
      close_time: closeTimeUTC,
      retake: allow_retake,
      shuffle: shuffle_questions,
      no_time: no_time_limit,
    };

    setFormErrors([]);
    mutateUpdateQuiz(submittedValues);
  }

  return (
    <div className="max-h-[90vh] overflow-y-auto">
      <DialogHeader className="flex flex-row items-center gap-2">
        <Settings className="hidden size-8 rounded-full bg-purple-100 fill-purple-700 p-1 md:block" />
        <div className="p-0">
          <DialogTitle>Quiz Settings</DialogTitle>
          <DialogDescription>
            Customize your quiz settings below to suit your preferences.
          </DialogDescription>
        </div>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 md:grid md:grid-cols-2"
        >
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter quiz title"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the description"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Subject</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between border border-zinc-200 dark:border-zinc-600",
                            !field.value && "text-muted-foreground",
                          )}
                          disabled={isPending}
                        >
                          {field.value
                            ? transformedSubjectData.find(
                                (subject) => subject.value === field.value,
                              )?.label
                            : "Select relevant subject"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[--radix-popover-content-available-height] w-[--radix-popover-trigger-width]">
                      <Command>
                        <CommandInput placeholder="Search subject..." />
                        <CommandList>
                          <CommandEmpty>No subject found.</CommandEmpty>
                          <CommandGroup>
                            {transformedSubjectData.map((subject) => (
                              <CommandItem
                                value={subject.label}
                                key={subject.value}
                                onSelect={() => {
                                  form.setValue(
                                    "subject",
                                    subject.value as Subject,
                                  );
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    subject.value === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {subject.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_scheduled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-zinc-200 p-4 dark:border-zinc-600">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setIsScheduled(checked as boolean);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Schedule Quiz</FormLabel>
                    <FormDescription>
                      Set a specific open and close time for this quiz.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {isScheduled && (
              <>
                <FormField
                  control={form.control}
                  name="open_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Open Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          min={
                            new Date(new Date().setHours(0, 0, 0, 0))
                              .toISOString()
                              .slice(0, 16)
                          }
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="close_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Close Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          min={
                            form.getValues("open_time") ||
                            new Date(new Date().setHours(0, 0, 0, 0))
                              .toISOString()
                              .slice(0, 16)
                          }
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                      {showOvernightWarning && (
                        <p className="text-sm text-amber-600">
                          Notice: This quiz spans across multiple days (overnight
                          schedule).
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
          <div className="w-full space-y-4 md:w-52 md:justify-self-end">
            <Controller
              name="cover_image"
              control={form.control}
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-4">
                      {coverImagePreview ? (
                        <div className="relative">
                          <img
                            src={coverImagePreview}
                            alt="Cover preview"
                            className="size-52 rounded object-cover"
                          />
                          <button
                            type="button"
                            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1"
                            onClick={handleRemoveImage}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="cover-image-upload"
                          className={cn(
                            "flex size-52 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed",
                            isPending && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Upload className="h-6 w-6 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-500">
                            Upload image
                          </p>
                        </label>
                      )}
                      <Input
                        id="cover-image-upload"
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={(e) => {
                          handleImageChange(e);
                          onChange(e.target.files?.[0] || null);
                        }}
                        className="hidden"
                        disabled={isPending}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isScheduled && (
              <div className="space-y-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-600">
                <FormField
                  control={form.control}
                  name="shuffle_questions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Shuffle Questions</FormLabel>
                        <FormDescription>
                          Randomize the order of questions for each attempt to
                          reduce cheating.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allow_retake"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Allow Retakes</FormLabel>
                        <FormDescription>
                          Let students retake the quiz multiple times within the
                          scheduled window.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="no_time_limit"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>No Time Limit</FormLabel>
                        <FormDescription>
                          Remove the time limit for quiz completion. Students
                          can take as long as needed within the scheduled
                          window.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
          <Button
            type="submit"
            className="col-span-2 w-fit justify-self-end"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving..
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
