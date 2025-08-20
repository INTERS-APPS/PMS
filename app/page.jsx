"use client"

import { useState } from "react"
import LoginPage from "../components/login-page"
import TaskPage from "../components/task-page"
import Footer from "../components/footer"

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleLogin = (username, password) => {
    if (username === "admin" && password === "admin123") {
      setIsLoggedIn(true)
      return true
    }
    return false
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {!isLoggedIn ? <LoginPage onLogin={handleLogin} /> : <TaskPage onLogout={handleLogout} />}
      </div>
      <Footer />
    </div>
  )
}
