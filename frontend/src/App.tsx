import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  useAuth,
} from "@clerk/clerk-react";
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { setTokenGetter } from "./api/client";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import ClassDetailPage from "./pages/ClassDetailPage";
import LectureDetailPage from "./pages/LectureDetailPage";
import NewLecturePage from "./pages/NewLecturePage";
import AdminPage from "./pages/AdminPage";
import DbPage from "./pages/DbPage";
import ExplorePage from "./pages/ExplorePage";

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
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/classes/:classId" element={<ClassDetailPage />} />
            <Route path="/lectures/:lectureId" element={<LectureDetailPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/new-lecture" element={<NewLecturePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/db" element={<DbPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AppShell>
      </SignedIn>
    </>
  );
}
