"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import PartyTable from "./party-table"
import StageTable from "./stage-table" // This is now the party-stages-table
import TaskTable from "./task-table"

export default function TaskPage({ onLogout }) {
  const [currentView, setCurrentView] = useState("parties") // Start with parties
  const [selectedParty, setSelectedParty] = useState(null)
  const [selectedStage, setSelectedStage] = useState(null)

  // Handle party selection - move to stages view
  const handlePartyAction = (party) => {
    setSelectedParty(party)
    setSelectedStage(null) // Clear any previous stage selection
    setCurrentView("stages")
  }

  // Handle stage selection - move to tasks view
  const handleStageAction = (stage) => {
    setSelectedStage(stage)
    setCurrentView("tasks")
  }

  // Navigate back function
  const handleBack = () => {
    if (currentView === "tasks") {
      setCurrentView("stages")
      setSelectedStage(null)
    } else if (currentView === "stages") {
      setCurrentView("parties")
      setSelectedParty(null)
      setSelectedStage(null)
    }
  }

  // Get breadcrumb text
  const getBreadcrumb = () => {
    if (currentView === "parties") return "All Parties"
    if (currentView === "stages") return `${selectedParty?.name} > Stages`
    if (currentView === "tasks") return `${selectedParty?.name} > ${selectedStage?.name} > Tasks`
    return ""
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">PMS - Project Management System</h1>
            <Button onClick={onLogout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">{getBreadcrumb()}</h2>
            {currentView !== "parties" && (
              <Button onClick={handleBack} variant="outline">
                ← Back
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Step 1: Show all parties */}
            {currentView === "parties" && (
              <PartyTable onAction={handlePartyAction} />
            )}
            
            {/* Step 2: Show stages for selected party */}
            {currentView === "stages" && (
              <StageTable 
                party={selectedParty} 
                onAction={handleStageAction} 
              />
            )}
            
            {/* Step 3: Show tasks for selected party in selected stage */}
            {currentView === "tasks" && (
              <TaskTable 
                party={selectedParty} 
                stage={selectedStage} 
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}