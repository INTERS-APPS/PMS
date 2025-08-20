"use client"

import { Button } from "./ui/button"
import { useState, useEffect } from "react"

// API configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxs9tUMiRRz3MmDBWR2627KSD69GKmcPUbsD39uVlrnfaCU3fMGZL3TkZQSgFIS5zkK/exec"

export default function PartyStagesTable({ party, onAction }) {
  const [stageData, setStageData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Function to make POST request to Google Apps Script
  const makeRequest = async (action, additionalParams = {}) => {
    const formData = new FormData()
    formData.append('action', action)
    
    Object.keys(additionalParams).forEach(key => {
      formData.append(key, additionalParams[key])
    })

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred')
    }

    return result.data
  }

  // Function to fetch stage data for the selected party
  const fetchPartyStages = async () => {
    if (!party || !party.stagesPresent || !party.stagesPresent.length) {
      setStageData([])
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Get detailed data for each stage where this party appears
      const stagePromises = party.stagesPresent.map(async (stageName, index) => {
        try {
          const stageInfo = await makeRequest('getStageData', { stageName })
          
          // Filter tasks for this specific party
          const partyTasks = stageInfo.filter(task => {
            // Try to get party name from the task (Column C)
            let taskPartyName = null
            
            // Method 1: Try by column index (Column C = index 2)
            const taskValues = Object.values(task)
            if (taskValues.length > 2 && taskValues[2]) {
              taskPartyName = taskValues[2]
            }
            
            // Method 2: Try by header name variations
            if (!taskPartyName) {
              const possibleHeaders = ['Party Name', 'party', 'Party', 'PARTY NAME', 'PartyName', 'party_name']
              for (const header of possibleHeaders) {
                if (task[header]) {
                  taskPartyName = task[header]
                  break
                }
              }
            }
            
            return taskPartyName && taskPartyName.toString().trim() === party.name
          })

          // Calculate progress for this party in this stage
          let totalTasks = partyTasks.length
          let completedTasks = 0
          
          // Count completed tasks based on status
          partyTasks.forEach(task => {
            // Look for status in various possible columns
            const possibleStatusFields = ['Status', 'status', 'STATUS', 'State', 'state', 'Progress', 'progress', 'Complete', 'complete', 'Done', 'done']
            let status = null
            
            for (const field of possibleStatusFields) {
              if (task[field]) {
                status = task[field]
                break
              }
            }
            
            if (status) {
              const statusStr = status.toString().toLowerCase().trim()
              if (statusStr === 'completed' || 
                  statusStr === 'done' || 
                  statusStr === 'finished' || 
                  statusStr === 'complete' ||
                  statusStr === '100%' ||
                  statusStr === 'yes' ||
                  statusStr === 'y' ||
                  statusStr === '1' ||
                  statusStr === 'true') {
                completedTasks++
              }
            }
          })
          
          const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
          
          return {
            id: index + 1,
            name: stageName,
            totalTasks,
            completed: completedTasks,
            progress: Math.round(progress * 10) / 10,
            partyTasks // Store the filtered tasks for this party
          }
        } catch (err) {
          console.error(`Error fetching data for stage ${stageName}:`, err)
          return {
            id: index + 1,
            name: stageName,
            totalTasks: 0,
            completed: 0,
            progress: 0,
            partyTasks: []
          }
        }
      })
      
      const results = await Promise.all(stagePromises)
      setStageData(results)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching party stages:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when party changes
  useEffect(() => {
    fetchPartyStages()
  }, [party])

  // Handle stage selection
  const handleStageSelect = (stage) => {
    if (onAction) {
      onAction({
        ...stage,
        partyName: party.name,
        partyId: party.id,
        // Pass the tasks for this party in this stage
        tasks: stage.partyTasks
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Loading stages for {party?.name}...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8">
        <div className="text-red-600 text-lg mb-4">Error: {error}</div>
        <Button onClick={fetchPartyStages} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    )
  }

  if (!party) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select a party to view their stages
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Stages for {party.name}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Showing {stageData.length} stages where {party.name} appears
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Stage Name</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Party Tasks</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Completed</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Progress</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {stageData.map((stage) => (
              <tr key={stage.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  {stage.name}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                    {stage.totalTasks}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                    {stage.completed}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min(stage.progress, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {stage.progress.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <Button
                    onClick={() => handleStageSelect(stage)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    View Tasks
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {stageData.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">No stages found for {party.name}</div>
          <div className="text-sm">
            This party may not appear in any stages
          </div>
        </div>
      )}
    </div>
  )
}