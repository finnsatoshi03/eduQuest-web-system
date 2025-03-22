# eduQuest Web System

eduQuest is a modern interactive educational platform designed to enhance the learning experience for both students and professors. Built with React, TypeScript, and Vite, this web application provides a seamless interface for creating, managing, and participating in educational quizzes.

## Features

### For Professors

- **Interactive Dashboard**: Manage classes, quizzes, and student performance
- **Quiz Creation Tools**:
  - Select from multiple question types
  - Customize quiz settings and parameters
  - Generate quizzes with specific requirements
  - Edit questions and quiz structures
- **Live Quiz Sessions**: Host real-time quiz competitions in virtual classrooms
- **Performance Analytics**: Review student responses and track progress
- **Scheduled Assessments**: Set up timed quizzes for future dates

### For Students

- **Personalized Dashboard**: View enrolled classes and upcoming quizzes
- **Quiz Participation**: Join live quiz sessions with real-time feedback
- **Scheduled Assessments**: Take assigned quizzes within specific timeframes
- **Performance Tracking**: Monitor progress and achievements

### General Features

- **User Authentication**: Secure login and signup with email verification
- **Role Management**: Distinct interfaces for professors and students
- **Profile Settings**: Customize personal information and preferences
- **Responsive Design**: Fully functional across all device sizes
- **Dark/Light Theme**: Choose your preferred visual theme

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **State Management**: React Context API, React Query
- **UI Components**: Radix UI, Shadcn
- **Routing**: React Router DOM
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **Styling**: TailwindCSS, Tailwind Merge
- **Form Management**: React Hook Form, Zod validation
- **Notifications**: React Hot Toast
- **Build Tool**: Vite

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/eduquest-web-system.git

# Navigate to the project directory
cd eduquest-web-system

# Install dependencies
npm install

# Set up environment variables
# Create a .env file with the following variables:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# VITE_GOOGLE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key

# Start the development server
npm run dev
```

## 📝 Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview the production build locally

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
