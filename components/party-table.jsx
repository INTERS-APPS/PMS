"use client"

import { Button } from "./ui/button"
import { useState, useEffect } from "react"

// API configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxs9tUMiRRz3MmDBWR2627KSD69GKmcPUbsD39uVlrnfaCU3fMGZL3TkZQSgFIS5zkK/exec"

export default function PartyTable({ onAction }) {
  const [partyData, setPartyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)

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

  // Function to fetch all parties from all stages
  const fetchAllParties = async () => {
    if (!mounted) return

    setLoading(true)
    setError(null)
    
    try {
      // First try the dedicated getAllParties method
      try {
        const allPartiesData = await makeRequest('getAllParties')
        console.log('All parties data (primary method):', allPartiesData)
        
        if (allPartiesData && allPartiesData.length > 0) {
          // Keep original order - do NOT sort alphabetically
          // This maintains the serial number order from your sheets
          setPartyData(allPartiesData)
          return
        } else {
          console.warn('getAllParties returned empty data, falling back...')
        }
      } catch (primaryErr) {
        console.warn('getAllParties failed, falling back to getAllStageData:', primaryErr.message)
      }

      // Fallback: Get all stage data to extract all unique parties
      const allStageData = await makeRequest('getAllStageData')
      // Fallback: Get all stage data to extract all unique parties
      // const allStageData = await makeRequest('getAllStageData')
      
      // Extract all unique party names from all stages
      const allParties = new Set()
      const partyStageMapping = {}

      allStageData.forEach(stageInfo => {
        if (stageInfo.stageData && Array.isArray(stageInfo.stageData)) {
          // Get stage name
          let stageName = stageInfo.name || 
                         stageInfo['Stage Name'] || 
                         stageInfo['Stage'] || 
                         Object.keys(stageInfo).find(key => typeof stageInfo[key] === 'string' && key !== 'stageData') ||
                         Object.values(stageInfo).find(val => typeof val === 'string') ||
                         'Unknown Stage'

          stageInfo.stageData.forEach((row, index) => {
            // Skip header row
            if (index === 0) return

            // Try to get party name from the row (Column C = index 2)
            let partyName = null
            
            // Method 1: Direct column C access (most reliable for your structure)
            const rowValues = Object.values(row)
            if (rowValues.length > 2 && rowValues[2]) {
              const columnCValue = rowValues[2]
              if (typeof columnCValue === 'string' && 
                  columnCValue.trim() && 
                  columnCValue.trim().toLowerCase() !== 'party name' &&
                  !columnCValue.includes('Party Name')) {
                partyName = columnCValue.trim()
              }
            }
            
            // Method 2: Try by header name if Method 1 fails
            if (!partyName) {
              const possibleHeaders = ['Party Name', 'party', 'Party', 'PARTY NAME', 'PartyName', 'party_name', 'Party_Name']
              for (const header of possibleHeaders) {
                if (row[header] && typeof row[header] === 'string') {
                  const headerValue = row[header].trim()
                  if (headerValue && headerValue.toLowerCase() !== 'party name') {
                    partyName = headerValue
                    break
                  }
                }
              }
            }
            
            console.log(`Stage: ${stageName}, Row ${index + 1}, Column C value: "${rowValues[2]}", Extracted party: "${partyName}"`) // Debug log
            
            if (partyName && 
                partyName.toString().trim() && 
                partyName.toString().trim() !== '' && 
                partyName.toString().trim().toLowerCase() !== 'party name' &&
                !partyName.toString().trim().match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) { // Exclude dates
              
              const cleanPartyName = partyName.toString().trim()
              allParties.add(cleanPartyName)
              
              // Track which stages this party appears in
              if (!partyStageMapping[cleanPartyName]) {
                partyStageMapping[cleanPartyName] = new Set()
              }
              if (stageName) {
                partyStageMapping[cleanPartyName].add(stageName)
              }
            }
          })
        }
      })

      // Transform data for display - maintain original order
      const transformedData = Array.from(allParties).map((partyName, index) => ({
        id: index + 1,
        name: partyName,
        totalProjects: partyStageMapping[partyName] ? partyStageMapping[partyName].size : 0, // Count unique stages
        stagesPresent: partyStageMapping[partyName] ? Array.from(partyStageMapping[partyName]) : []
      }))

      // Do NOT sort - keep the original order from the sheets
      // This preserves your serial number sequence
      
      console.log('Extracted parties (fallback):', transformedData)
      console.log('Sample stage data structure:', allStageData[0]) // Debug log
      setPartyData(transformedData)
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching party data:', err)
    } finally {
      setLoading(false)
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
        // Pass all the stages where this party appears
        availableStages: party.stagesPresent
      })
    }
  }

  // Don't render anything until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="overflow-x-auto">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Loading...</h3>
        </div>
        
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">S.No.</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Party Name</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Total Stages</th>
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2" colSpan="4">
                <div className="text-center py-4">Loading...</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Loading all parties...</div>
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
        <p className="text-sm text-gray-600 mt-1">
          Select a party to view stages where they appear
        </p>
      </div>
      
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-blue-100">
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">S.No.</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Party Name</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Total Stages</th>
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
    </div>
  )
}