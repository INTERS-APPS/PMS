"use client";

import React, { useState } from "react";
import LoginPage from "../components/login-page";
import TaskPage from "../components/task-page";
import Footer from "../components/footer";

// Define the prop types expected for LoginPage and TaskPage
type LoginPageProps = {
  onLogin: (username: string, password: string) => boolean;
};

type TaskPageProps = {
  onLogout: () => void;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // Type the arguments
  const handleLogin = (username: string, password: string): boolean => {
    if (username === "admin" && password === "admin123") {
      setIsLoggedIn(true);
      return true;
    }
    return false;
  };

  const handleLogout = (): void => {
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {!isLoggedIn ? (
          // If you have types for LoginPage, pass them as props.
          // <LoginPage onLogin={handleLogin} />
          // Otherwise, just use as shown.
          <LoginPage onLogin={handleLogin} />
        ) : (
          <TaskPage onLogout={handleLogout} />
        )}
      </div>
      <Footer />
    </div>
  );
}
