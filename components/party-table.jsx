"use client"

import { Button } from "./ui/button"
import { useState, useEffect } from "react"

// API configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpSqjz4o3AMDnurfTm2L54U5NB5XXo2ztDW67GGZsRA-l3HiNpYfNXlamaZ4-2M7w/exec"

export default function PartyTable({ onAction }) {
  const [partyData, setPartyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [pendingAnalysisLoading, setPendingAnalysisLoading] = useState(false)

  // Cache for stage data to avoid repeated API calls
  const [stageDataCache, setStageDataCache] = useState(new Map())

  // Prevent hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Check if stage has horizontal category layout
  const isHorizontalCategoryStage = (stageName) => {
    const horizontalStages = [
      'Site Management', 
      'CIVIL & FABRICATION', 
      'SERVICES & Complete Stone Work'
    ]
    return horizontalStages.some(name => 
      stageName.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(stageName.toLowerCase())
    )
  }

  // Optimized function to get cached stage data
  const getCachedStageData = async (stageName) => {
    if (stageDataCache.has(stageName)) {
      return stageDataCache.get(stageName)
    }
    
    try {
      const stageData = await makeRequest('getStageData', { stageName })
      stageDataCache.set(stageName, stageData)
      setStageDataCache(new Map(stageDataCache))
      return stageData
    } catch (error) {
      console.warn(`Error fetching stage data for ${stageName}:`, error)
      return []
    }
  }

  // Calculate stage completion using the same logic as StageTable
  const calculateStageCompletion = (stageData, stageName, partyName) => {
    if (!stageData || stageData.length === 0) {
      return { totalTasks: 0, completedTasks: 0, isComplete: false }
    }

    if (isHorizontalCategoryStage(stageName)) {
      return calculateHorizontalStageCompletion(stageData, partyName)
    } else {
      return calculateRegularStageCompletion(stageData, partyName)
    }
  }

  // Calculate completion for horizontal category stages (matches StageTable logic)
  const calculateHorizontalStageCompletion = (stageData, partyName) => {
    const headerRowIndex = 4
    const dataStartRowIndex = 5
    
    // Find party rows first
    const partyRows = []
    for (let rowIndex = dataStartRowIndex; rowIndex < Math.min(stageData.length, dataStartRowIndex + 50); rowIndex++) {
      const row = stageData[rowIndex]
      const rowPartyName = row['col_2'] ? row['col_2'].toString().trim() : null
      
      if (rowPartyName && rowPartyName.toLowerCase() === partyName.toLowerCase()) {
        partyRows.push(row)
      }
    }
    
    if (partyRows.length === 0) {
      return { totalTasks: 0, completedTasks: 0, isComplete: false }
    }

    let totalTasks = 0
    let completedTasks = 0

    for (const row of partyRows) {
      for (let colIndex = 5; colIndex <= 100; colIndex += 5) {
        const taskName = row[`col_${colIndex}`]
        const status = row[`col_${colIndex + 4}`]
        
        if (taskName && taskName.toString().trim() && taskName.toString().trim() !== '-') {
          totalTasks++
          const cleanStatus = status && status.toString().trim() !== '' && status.toString().trim() !== '-' ? status.toString().trim() : null
          
          // Use same completion logic as StageTable
          if (cleanStatus) {
            const statusStr = cleanStatus.toLowerCase().trim()
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
        }
      }
    }
    
    // Stage is complete ONLY when totalTasks equals completedTasks (and both > 0)
    const isComplete = totalTasks > 0 && totalTasks === completedTasks
    
    return { totalTasks, completedTasks, isComplete }
  }

  // Calculate completion for regular stages (matches StageTable logic)
  const calculateRegularStageCompletion = (stageData, partyName) => {
    // Filter tasks for this specific party (same logic as StageTable)
    const partyTasks = stageData.filter(task => {
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
      return taskPartyName && 
        taskPartyName.toString().trim().toUpperCase() === partyName.toString().trim().toUpperCase()
    })

    let totalTasks = partyTasks.length
    let completedTasks = 0
    
    // Count completed tasks based on status (same logic as StageTable)
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

    // Stage is complete ONLY when totalTasks equals completedTasks (and both > 0)
    const isComplete = totalTasks > 0 && totalTasks === completedTasks
    
    return { totalTasks, completedTasks, isComplete }
  }

  // Batch analyze all stages for all parties at once
  const batchAnalyzePendingStages = async (partiesData) => {
    // Get all unique stages across all parties
    const allStages = new Set()
    partiesData.forEach(party => {
      if (party.stagesPresent) {
        party.stagesPresent.forEach(stage => allStages.add(stage))
      }
    })

    // Fetch all stage data in parallel (limited concurrency)
    const stageArray = Array.from(allStages)
    const batchSize = 3
    
    for (let i = 0; i < stageArray.length; i += batchSize) {
      const batch = stageArray.slice(i, i + batchSize)
      const batchPromises = batch.map(stageName => getCachedStageData(stageName))
      await Promise.allSettled(batchPromises)
      
      if (i + batchSize < stageArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Now analyze pending stages for each party
    const updatedParties = partiesData.map(party => {
      const pendingStages = []
      const stageDetails = []
      
      console.log(`\nAnalyzing stages for party: ${party.name}`)
      
      if (party.stagesPresent) {
        party.stagesPresent.forEach(stageName => {
          const stageData = stageDataCache.get(stageName)
          if (stageData) {
            const completion = calculateStageCompletion(stageData, stageName, party.name)
            
            console.log(`${stageName}: ${completion.completedTasks}/${completion.totalTasks} tasks completed, Complete: ${completion.isComplete}`)
            
            stageDetails.push({
              name: stageName,
              totalTasks: completion.totalTasks,
              completedTasks: completion.completedTasks,
              isComplete: completion.isComplete
            })
            
            if (!completion.isComplete) {
              pendingStages.push(stageName)
            }
          } else {
            // If no stage data, consider it pending
            pendingStages.push(stageName)
            stageDetails.push({
              name: stageName,
              totalTasks: 0,
              completedTasks: 0,
              isComplete: false
            })
          }
        })
      }
      
      console.log(`${party.name}: ${pendingStages.length} pending stages: [${pendingStages.join(', ')}]`)
      
      return {
        ...party,
        pendingStages,
        pendingStagesCount: pendingStages.length,
        stageDetails // Include detailed info for debugging
      }
    })

    return updatedParties
  }

  // Main function to fetch all parties
  const fetchAllParties = async () => {
    if (!mounted) return

    setLoading(true)
    setError(null)
    
    try {
      let partiesData = []

      // First try the dedicated getAllParties method
      try {
        const allPartiesData = await makeRequest('getAllParties')
        
        if (allPartiesData && allPartiesData.length > 0) {
          partiesData = allPartiesData
        } else {
          throw new Error('Empty data from getAllParties')
        }
      } catch (primaryErr) {
        console.warn('getAllParties failed, falling back to getAllStageData:', primaryErr.message)
        
        // Fallback method
        const allStageData = await makeRequest('getAllStageData')
        const allParties = new Set()
        const partyStageMapping = {}

        allStageData.forEach(stageInfo => {
          if (stageInfo.stageData && Array.isArray(stageInfo.stageData)) {
            let stageName = stageInfo.name || 'Unknown Stage'

            stageInfo.stageData.forEach((row, index) => {
              if (index === 0) return // Skip header

              const rowValues = Object.values(row)
              let partyName = null
              
              if (rowValues.length > 2 && rowValues[2]) {
                const columnCValue = rowValues[2]
                if (typeof columnCValue === 'string' && 
                    columnCValue.trim() && 
                    columnCValue.trim().toLowerCase() !== 'party name') {
                  partyName = columnCValue.trim()
                }
              }
              
              if (partyName && 
                  !partyName.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                
                allParties.add(partyName)
                
                if (!partyStageMapping[partyName]) {
                  partyStageMapping[partyName] = new Set()
                }
                partyStageMapping[partyName].add(stageName)
              }
            })
          }
        })

        // Transform to expected format
        partiesData = Array.from(allParties).map((partyName, index) => ({
          id: index + 1,
          name: partyName,
          totalProjects: partyStageMapping[partyName] ? partyStageMapping[partyName].size : 0,
          stagesPresent: partyStageMapping[partyName] ? Array.from(partyStageMapping[partyName]) : []
        }))
      }

      // Set initial data without pending analysis
      setPartyData(partiesData.map(party => ({
        ...party,
        pendingStages: [],
        pendingStagesCount: 0
      })))
      
      setLoading(false)

      // Now analyze pending stages in background
      setPendingAnalysisLoading(true)
      const updatedParties = await batchAnalyzePendingStages(partiesData)
      setPartyData(updatedParties)
      setPendingAnalysisLoading(false)
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching party data:', err)
      setLoading(false)
      setPendingAnalysisLoading(false)
    }
  }

  // Fetch data when component mounts
  useEffect(() => {
    if (mounted) {
      fetchAllParties()
    }
  }, [mounted])

  // Handle party selection
  const handlePartySelect = (party) => {
    if (onAction) {
      onAction({
        ...party,
        availableStages: party.stagesPresent
      })
    }
  }

  // Function to render pending stages with improved UI
  const renderPendingStages = (party) => {
    if (pendingAnalysisLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600">Analyzing...</span>
        </div>
      )
    }

    const pendingCount = party.pendingStages ? party.pendingStages.length : 0
    const totalStages = party.totalProjects
    const completedCount = totalStages - pendingCount

    if (pendingCount === 0) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <span className="text-green-600">✓</span>
            All Complete
          </div>
          <span className="text-xs text-gray-500">({totalStages}/{totalStages})</span>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {/* Summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            <span className="text-red-600">⚠</span>
            {pendingCount} Pending
          </div>
          <span className="text-xs text-gray-500">({completedCount}/{totalStages} complete)</span>
        </div>

        {/* Pending stages list with task counts */}
        <div className="max-h-32 overflow-y-auto">
          <div className="text-xs text-gray-600 space-y-1">
            {party.pendingStages && party.pendingStages.map((stageName, index) => {
              // Find stage details if available
              const stageDetail = party.stageDetails?.find(s => s.name === stageName)
              const taskInfo = stageDetail ? ` (${stageDetail.completedTasks}/${stageDetail.totalTasks})` : ''
              
              return (
                <div key={index} className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-500 rounded-full flex-shrink-0"></span>
                  <span className="truncate" title={`${stageName}${taskInfo}`}>
                    {stageName}{taskInfo}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (!mounted || loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">
          {loading ? "Loading parties..." : "Initializing..."}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8">
        <div className="text-red-600 text-lg mb-4">Error: {error}</div>
        <Button onClick={fetchAllParties} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">All Parties</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
          <span>Select a party to view stages. Pending stages: Party Tasks ≠ Completed count.</span>
          {pendingAnalysisLoading && (
            <span className="inline-flex items-center gap-1 text-blue-600">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Analyzing stage completion...
            </span>
          )}
        </div>
      </div>
      
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-blue-100">
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">S.No.</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Party Name</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Total Stages</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold min-w-80">
              Stage Status
              {pendingAnalysisLoading && <span className="ml-1 text-xs">⏳</span>}
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {partyData.map((party) => (
            <tr key={party.id} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2 text-center">{party.id}</td>
              <td className="border border-gray-300 px-4 py-2 font-medium">{party.name}</td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <span 
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium cursor-help" 
                  title={party.stagesPresent && party.stagesPresent.length > 0 ? `Present in: ${party.stagesPresent.join(', ')}` : 'No stage info'}
                >
                  {party.totalProjects}
                </span>
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {renderPendingStages(party)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <Button 
                  onClick={() => handlePartySelect(party)} 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  View Stages
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {partyData.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">No parties found</div>
          <div className="text-sm">
            Make sure your sheets have data in Column C (Party Name)
          </div>
        </div>
      )}
      
      {/* Enhanced summary with better insights */}
      {partyData.length > 0 && !pendingAnalysisLoading && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{partyData.length}</div>
              <div className="text-gray-600">Total Parties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {partyData.filter(p => p.pendingStages && p.pendingStages.length > 0).length}
              </div>
              <div className="text-gray-600">With Pending Stages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {partyData.filter(p => !p.pendingStages || p.pendingStages.length === 0).length}
              </div>
              <div className="text-gray-600">All Stages Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(() => {
                  const totalPendingStages = partyData.reduce((sum, party) => 
                    sum + (party.pendingStages ? party.pendingStages.length : 0), 0)
                  return totalPendingStages
                })()}
              </div>
              <div className="text-gray-600">Total Pending Stages</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}