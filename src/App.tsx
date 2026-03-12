import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/landing/LandingPage";
import { SigninPage } from "./pages/signin/SigninPage";
import { SignupPage } from "./pages/signup/SignupPage";
import { ForgotPasswordPage } from "./pages/forgot-password/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/reset-password/ResetPasswordPage";
import { CallbackPage } from "./pages/auth/CallbackPage";
import { GamesPage } from "./pages/games/GamesPage";
import { NewGamePage } from "./pages/games/NewGamePage";
import { LoadGamesPage } from "./pages/games/LoadGamesPage";
import { AboutPage } from "./pages/about/AboutPage";
import { GamePage } from "./pages/game/GamePage";
import { AdminPage } from "./pages/admin/AdminPage";
import { ThemeEditorPage } from "./pages/admin/ThemeEditorPage";

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SigninPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/new" element={<NewGamePage />} />
      <Route path="/games/list" element={<LoadGamesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/game/:id" element={<GamePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/theme/:themeId" element={<ThemeEditorPage />} />
    </Routes>
  );
};
