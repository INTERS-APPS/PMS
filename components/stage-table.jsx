"use client"

import { Button } from "./ui/button"
import { useState, useEffect } from "react"

// API configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpSqjz4o3AMDnurfTm2L54U5NB5XXo2ztDW67GGZsRA-l3HiNpYfNXlamaZ4-2M7w/exec"

export default function StageTable({ party, onAction }) {
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
      console.log(`Fetching stages for party: ${party.name}`)
      console.log(`Stages present: ${party.stagesPresent.join(', ')}`)
      
      // Get detailed data for each stage where this party appears
      const stagePromises = party.stagesPresent.map(async (stageName, index) => {
        try {
          const stageInfo = await makeRequest('getStageData', { stageName })
          
          console.log(`Processing stage: ${stageName}, received ${stageInfo.length} total records`)
          
          // Filter tasks for this specific party
          const partyTasks = stageInfo.filter(task => {
            let taskPartyName = null
            
            // Method 1: Use standardized key from Google Apps Script
            if (task['PartyName']) {
              taskPartyName = task['PartyName']
            }
            
            // Method 2: Try by header variations
            if (!taskPartyName) {
              const possibleHeaders = ['Party Name', 'party', 'Party', 'PARTY NAME', 'party_name']
              for (const header of possibleHeaders) {
                if (task[header]) {
                  taskPartyName = task[header]
                  break
                }
              }
            }
            
            // Method 3: Try by column index (Column C = index 2) as fallback
            if (!taskPartyName) {
              const taskValues = Object.values(task)
              if (taskValues.length > 2 && taskValues[2]) {
                taskPartyName = taskValues[2]
              }
            }
            
            // Check for exact match (case-insensitive and trimmed)
            const matches = taskPartyName && 
              taskPartyName.toString().trim().toUpperCase() === party.name.toString().trim().toUpperCase()
            
            if (matches) {
              console.log(`Found matching task in ${stageName} for ${party.name}:`, {
                taskParty: taskPartyName,
                draftCategory: task['DraftCategory'] || task['Draft Category'],
                draftName: task['DraftName'] || task['Draft Name']
              })
            }
            
            return matches
          })

          console.log(`Found ${partyTasks.length} tasks for ${party.name} in ${stageName}`)

          // Calculate progress for this party in this stage
          let totalTasks = partyTasks.length
          let completedTasks = 0
          
          // Count completed tasks based on status
          partyTasks.forEach(task => {
            let status = null
            
            // Try different status field names
            if (task['Status']) {
              status = task['Status']
            } else if (task['Azure Status']) {
              status = task['Azure Status']
            } else if (task['status']) {
              status = task['status']
            }
            
            // Fallback to column position (Column K = index 10)
            if (!status) {
              const taskValues = Object.values(task)
              if (taskValues.length > 10 && taskValues[10]) {
                status = taskValues[10]
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
                  statusStr === 'y') {
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
            partyTasks, // Store the filtered tasks for this party
            partyName: party.name
          }
        } catch (err) {
          console.error(`Error fetching data for stage ${stageName}:`, err)
          return {
            id: index + 1,
            name: stageName,
            totalTasks: 0,
            completed: 0,
            progress: 0,
            partyTasks: [],
            partyName: party.name,
            error: err.message
          }
        }
      })
      
      const results = await Promise.all(stagePromises)
      console.log('Final stage results:', results)
      setStageData(results)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching party stages:', err)
    } finally {
      setLoading(false)
    }
  }

  // Function to refresh data
  const refreshData = () => {
    fetchPartyStages()
  }

  // Fetch data when party changes
  useEffect(() => {
    fetchPartyStages()
  }, [party])

  // Handle stage selection
  const handleAction = (stage) => {
    if (onAction) {
      onAction({
        ...stage,
        // Pass the tasks for this party in this stage
        detailedData: stage.partyTasks,
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
        <Button onClick={refreshData} className="bg-blue-600 hover:bg-blue-700">
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
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">Stages for {party.name}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {stageData.length} stages where {party.name} appears
          </p>
        </div>
        <Button onClick={refreshData} variant="outline">
          Refresh Data
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">S.No.</th>
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
                <td className="border border-gray-300 px-4 py-2 text-center">{stage.id}</td>
                <td className="border border-gray-300 px-4 py-2 font-medium">
                  {stage.name}
                  {stage.error && (
                    <div className="text-red-500 text-xs mt-1">
                      Error: {stage.error}
                    </div>
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    stage.totalTasks > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {stage.totalTasks}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    stage.completed > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {stage.completed}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                      <div 
                        className={`h-2.5 rounded-full ${
                          stage.progress > 0 ? 'bg-blue-600' : 'bg-gray-400'
                        }`}
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
                    onClick={() => handleAction(stage)}
                    size="sm"
                    className={`${
                      stage.totalTasks > 0 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-400 hover:bg-gray-500'
                    }`}
                    disabled={stage.totalTasks === 0}
                  >
                    {stage.totalTasks > 0 ? 'View Tasks' : 'No Tasks'}
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
