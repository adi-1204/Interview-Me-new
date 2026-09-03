import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import Home from "./features/interview/pages/Home";
import Interview from "./features/interview/pages/Interview";
import ResumeReview from "./features/session/pages/ResumeReview";
import LiveInterview from "./features/session/pages/LiveInterview";
import Processing from "./features/session/pages/Processing";
import SessionReport from "./features/session/pages/SessionReport";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: (
      <Protected>
        <Home />
      </Protected>
    ),
  },
  {
    path: "/interview/:interviewId",
    element: (
      <Protected>
        <Interview />
      </Protected>
    ),
  },
  {
    path: "/session/resume-review/:resumeId",
    element: (
      <Protected>
        <ResumeReview />
      </Protected>
    ),
  },
  {
    path: "/session/live/:sessionId",
    element: (
      <Protected>
        <LiveInterview />
      </Protected>
    ),
  },
  {
    path: "/session/:sessionId/processing/:turnIndex",
    element: (
      <Protected>
        <Processing />
      </Protected>
    ),
  },
  {
    path: "/session/:sessionId/report",
    element: (
      <Protected>
        <SessionReport />
      </Protected>
    ),
  },
]);