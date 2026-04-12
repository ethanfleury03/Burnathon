import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import { useEffect } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { setTokenGetter } from "./api/client";
import DashboardPage from "./pages/DashboardPage";
import ClassDetailPage from "./pages/ClassDetailPage";
import LectureDetailPage from "./pages/LectureDetailPage";
import NewLecturePage from "./pages/NewLecturePage";
import AdminPage from "./pages/AdminPage";
import DbPage from "./pages/DbPage";

function NavBar() {
  const { user } = useUser();
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-xl font-bold text-indigo-600">
          Lecture Portal
        </Link>
        <Link
          to="/"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Dashboard
        </Link>
        <Link
          to="/new-lecture"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          New Lecture
        </Link>
        <Link
          to="/db"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          DB
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</span>
        <UserButton afterSignOutUrl="/" />
      </div>
    </nav>
  );
}

function TokenSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
  return null;
}

export default function App() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <TokenSync />
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/classes/:classId" element={<ClassDetailPage />} />
              <Route path="/lectures/:lectureId" element={<LectureDetailPage />} />
              <Route path="/new-lecture" element={<NewLecturePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/db" element={<DbPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </SignedIn>
    </>
  );
}
