import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./shared/auth";
import { GamesApp } from "./pages/games/GamesApp";
import { LandingApp } from "./pages/landing/LandingApp";
import { SigninApp } from "./pages/signin/SigninApp";
import { theme } from "./theme";

export const App = () => {
  return (
    <ChakraProvider value={theme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingApp />} />
            <Route path="/signin" element={<SigninApp />} />
            <Route path="/games" element={<GamesApp />} />
            <Route
              path="/game/:gameId"
              element={<Navigate to="/games" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  );
};
