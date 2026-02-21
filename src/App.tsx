import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/landing/LandingPage";
import { SigninPage } from "./pages/signin/SigninPage";
import { CallbackPage } from "./pages/auth/CallbackPage";
import { GamesPage } from "./pages/games/GamesPage";
import { GamePage } from "./pages/game/GamePage";

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SigninPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/game/:id" element={<GamePage />} />
    </Routes>
  );
}
