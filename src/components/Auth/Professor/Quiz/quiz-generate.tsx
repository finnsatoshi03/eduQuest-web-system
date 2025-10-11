import { useCallback, useEffect } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDownCircle, FileIcon, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useQuiz } from "@/contexts/QuizProvider";

const formSchema = z.object({
  pdf: z.instanceof(File).refine((file) => file.type === "application/pdf", {
    message: "Only PDF files are allowed",
  }),
});

export default function QuizGenerate() {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const { quizData, setQuizData } = useQuiz();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdf: undefined,
    },
  });

  useEffect(() => {
    if (quizData.file) {
      form.setValue("pdf", quizData.file);
    }
  }, [quizData.file, form]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (acceptedFiles[0]) {
        const file = acceptedFiles[0];
        form.setValue("pdf", file);
        setQuizData((prevData) => ({ ...prevData, file }));
      }
      if (fileRejections.length > 0) {
        toast.error("Invalid file type. Please upload a PDF file.");
      }
    },
    [form, setQuizData],
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive: dropzoneIsDragActive,
  } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  function onSubmit() {
    navigate(`/professor/quiz/${quizId}/type-selection`);
  }

  const removeFile = () => {
    form.setValue("pdf", null as unknown as File);
    setQuizData((prevData) => ({ ...prevData, file: null }));
  };

  return (
    <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-md space-y-8"
        >
          <FormField
            control={form.control}
            name="pdf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload PDF</FormLabel>
                <FormControl>
                  <div
                    {...getRootProps()}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                      dropzoneIsDragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {dropzoneIsDragActive ? (
                      <div className="flex flex-col items-center">
                        <ArrowDownCircle className="h-16 w-16 animate-bounce text-indigo-600" />
                        <p
                          className={`mt-4 ${dropzoneIsDragActive && "text-zinc-900"}`}
                        >
                          Drop the PDF file here!
                        </p>
                      </div>
                    ) : field.value ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileIcon className="h-8 w-8 text-indigo-600" />
                          <div className="text-left">
                            <p className="font-semibold">{field.value.name}</p>
                            <p className="text-sm text-gray-500">
                              File •{" "}
                              {(field.value.size / 1024 / 1024).toFixed(2)} MB •
                              PDF
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          width="96"
                          height="96"
                          src="https://img.icons8.com/material-outlined/3848a8/96/pdf-2.png"
                          alt="pdf-2"
                        />
                        <p className="text-xl">
                          Drag and drop a{" "}
                          <span className="font-bold text-indigo-600">
                            PDF file
                          </span>{" "}
                          here,
                        </p>
                        <p className="text-sm">
                          or{" "}
                          <span className="text-indigo-600 underline">
                            browse files
                          </span>{" "}
                          on your computer{" "}
                        </p>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Upload a PDF file to generate a quiz.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            // disabled={!form.formState.isValid}
          >
            Next
          </Button>
        </form>
      </Form>
    </div>
  );
}
