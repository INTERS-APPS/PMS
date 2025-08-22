"use client"

import { useState, useEffect, useMemo } from "react"

// API configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzpSqjz4o3AMDnurfTm2L54U5NB5XXo2ztDW67GGZsRA-l3HiNpYfNXlamaZ4-2M7w/exec"

export default function TaskTable({ party, stage }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Filter states
  const [draftCategoryFilter, setDraftCategoryFilter] = useState("")
  const [taskNameFilter, setTaskNameFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  
  // Dropdown visibility states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showTaskNameDropdown, setShowTaskNameDropdown] = useState(false)

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

  // Function to get column letter from index (0=A, 1=B, etc.)
  const getColumnLetter = (index) => {
    let result = ''
    let num = index
    while (num >= 0) {
      result = String.fromCharCode((num % 26) + 65) + result
      num = Math.floor(num / 26) - 1
      if (num < 0) break
    }
    return result
  }

  // Function to fetch tasks for horizontal category stages
  const fetchHorizontalTasks = async (stageData) => {
    console.log('Processing horizontal category stage:', stage.name)
    console.log('Raw stage data:', stageData)
    
    if (!stageData || stageData.length === 0) {
      console.log('No stage data available')
      return []
    }

    // For horizontal layout, data starts from row 6 (index 5) and categories from column F (index 5)
    // Header row is at index 4 (row 5 in sheet)
    const headerRowIndex = 4 // Row 5 in sheet (0-based index 4)
    const dataStartRowIndex = 5 // Row 6 in sheet (0-based index 5)
    const categoryStartColumnIndex = 5 // Column F (0-based index 5)
    
    console.log(`Looking for headers at row index ${headerRowIndex}`)
    console.log(`Data starts at row index ${dataStartRowIndex}`)
    console.log(`Categories start at column index ${categoryStartColumnIndex}`)
    
    // Extract category headers from the header row
    let categoryPositions = []
    
    if (stageData.length > headerRowIndex) {
      const headerRow = stageData[headerRowIndex]
      console.log('Header row data:', headerRow)
      
      // Auto-detect category columns starting from column F (index 5) with +5 increment
      // We'll check up to a reasonable maximum (let's say column 200 to be safe)
      const maxColumnToCheck = 200
      
      for (let colIndex = categoryStartColumnIndex; colIndex <= maxColumnToCheck; colIndex += 5) {
        const categoryKey = `col_${colIndex}`
        
        if (headerRow[categoryKey]) {
          const categoryName = headerRow[categoryKey].toString().trim()
          
          // Check if this is a valid category header (not empty, not just whitespace, and has reasonable length)
          if (categoryName && categoryName.length > 1 && categoryName !== '-' && categoryName !== 'N/A') {
            categoryPositions.push({
              name: categoryName,
              colIndex: colIndex,
              key: categoryKey
            })
            console.log(`Found category "${categoryName}" at column ${colIndex}`)
          } else {
            console.log(`Skipping empty/invalid category at column ${colIndex}:`, categoryName)
          }
        } else {
          // If we find several consecutive empty columns, we can break early to optimize
          // Check if the next few columns are also empty
          let consecutiveEmpty = 0
          for (let checkCol = colIndex; checkCol < colIndex + 15 && checkCol <= maxColumnToCheck; checkCol += 5) {
            if (!headerRow[`col_${checkCol}`] || headerRow[`col_${checkCol}`].toString().trim() === '') {
              consecutiveEmpty++
            }
          }
          
          // If we find 3 consecutive empty category positions, likely no more categories
          if (consecutiveEmpty >= 3) {
            console.log(`Found ${consecutiveEmpty} consecutive empty columns starting at ${colIndex}, stopping search`)
            break
          }
          
          console.log(`No data found at column ${colIndex}, continuing search...`)
        }
      }
    }
    
    console.log('Category positions found:', categoryPositions)
    
    if (categoryPositions.length === 0) {
      console.log('No category headers found')
      return []
    }

    // Find data rows for the specific party (starting from row 6)
    const partyTasks = []
    
    for (let rowIndex = dataStartRowIndex; rowIndex < stageData.length; rowIndex++) {
      const row = stageData[rowIndex]
      
      // Party name is in column C (index 2)
      const partyName = row['col_2'] ? row['col_2'].toString().trim() : null
      
      console.log(`Row ${rowIndex + 1} - Party found: "${partyName}" (looking for: "${party.name}")`)
      
      if (partyName && partyName.toLowerCase() === party.name.toLowerCase()) {
        partyTasks.push({ ...row, rowIndex })
        console.log(`Found matching party row ${rowIndex + 1}:`, row)
      }
    }
    
    console.log(`Found ${partyTasks.length} rows for party "${party.name}"`)
    
    if (partyTasks.length === 0) {
      return []
    }

    // Extract tasks from each category for each party row
    const transformedTasks = []
    
    partyTasks.forEach((partyRow, partyIndex) => {
      console.log(`Processing party row ${partyIndex + 1}`)
      
      // Process categories in the order they were found (column sequence)
      categoryPositions.forEach((category, categoryIndex) => {
        console.log(`Processing category "${category.name}" at column ${category.colIndex}`)
        
        // Based on the sheet structure: Category name (task name for this party), then Planned date, Actual, Delay, Status
        const taskNameCol = category.colIndex // This column contains the actual task name for this party
        const plannedCol = taskNameCol + 1
        const actualCol = taskNameCol + 2
        const delayCol = taskNameCol + 3
        const statusCol = taskNameCol + 4
        
        // Get the actual task name from the party's row in this category column
        const taskName = partyRow[`col_${taskNameCol}`] // This is the task name for this specific party
        const planned = partyRow[`col_${plannedCol}`]
        const actual = partyRow[`col_${actualCol}`]
        const delay = partyRow[`col_${delayCol}`]
        const status = partyRow[`col_${statusCol}`]
        
        console.log(`Category "${category.name}" data for party "${party.name}":`, {
          taskName, planned, actual, delay, status
        })
        
        // Clean and validate data
        const cleanValue = (val) => {
          if (!val || val === '' || val === null || val === undefined || val === '-') return null
          const str = val.toString().trim()
          return str === '' ? null : str
        }
        
        const cleanTaskName = cleanValue(taskName)
        const cleanPlanned = cleanValue(planned)
        const cleanActual = cleanValue(actual)
        const cleanDelay = cleanValue(delay)
        const cleanStatus = cleanValue(status)
        
        // Check if there's meaningful data in this category for this party
        if (cleanTaskName && (cleanPlanned || cleanActual || cleanStatus)) {
          const task = {
            id: `${partyIndex}-${categoryIndex}`,
            draftCategory: category.name, // This is the category header name
            name: cleanTaskName, // Only use actual task name, no fallback to category name
            status: cleanStatus || 'Pending',
            plannedDate: cleanPlanned,
            actualDate: cleanActual,
            delay: cleanDelay || '0',
            columnOrder: category.colIndex // Add column index for sorting
          }
          
          console.log(`Added task:`, task)
          transformedTasks.push(task)
        } else {
          console.log(`No task data found for party "${party.name}" in category "${category.name}"`)
        }
      })
    })
    
    console.log(`Total tasks extracted: ${transformedTasks.length}`)
    return transformedTasks
  }

  // Function to fetch tasks for regular stages
  const fetchRegularTasks = async (stageData) => {
    console.log('Processing regular stage:', stage.name)
    
    // Filter tasks for this specific party (existing logic)
    const partyTasks = stageData.filter(task => {
      let taskPartyName = null
      
      if (task['PartyName']) {
        taskPartyName = task['PartyName']
      }
      
      if (!taskPartyName) {
        const possibleHeaders = ['Party Name', 'party', 'Party', 'PARTY NAME', 'party_name']
        for (const header of possibleHeaders) {
          if (task[header]) {
            taskPartyName = task[header]
            break
          }
        }
      }
      
      if (!taskPartyName) {
        const taskValues = Object.values(task)
        if (taskValues.length > 2 && taskValues[2]) {
          taskPartyName = taskValues[2]
        }
      }
      
      const matches = taskPartyName && 
        taskPartyName.toString().trim().toUpperCase() === party.name.toString().trim().toUpperCase()
      
      return matches
    })

    // Transform tasks (existing logic)
    const transformedTasks = partyTasks.map((task, index) => {
      const taskValues = Object.values(task)
      
      let draftCategory = task['DraftCategory'] || task['Draft Category'] || null
      let draftName = task['DraftName'] || task['Draft Name'] || null
      let planned = task['Planned'] || null
      let actual = task['Actual'] || null
      let delay = task['Delay'] || null
      let status = task['Status'] || task['Azure Status'] || null
      
      // Fallback to column positions
      if (!draftCategory && taskValues[5]) draftCategory = taskValues[5]
      if (!draftName && taskValues[6]) draftName = taskValues[6]
      if (!planned && taskValues[7]) planned = taskValues[7]
      if (!actual && taskValues[8]) actual = taskValues[8]
      if (!delay && taskValues[9]) delay = taskValues[9]
      if (!status && taskValues[10]) status = taskValues[10]
      
      const cleanValue = (val) => {
        if (!val || val === '' || val === null || val === undefined || val === '-') return null
        const str = val.toString().trim()
        return str === '' ? null : str
      }
      
      return {
        id: index + 1,
        draftCategory: cleanValue(draftCategory) || 'General',
        name: cleanValue(draftName) || `Task ${index + 1}`,
        status: cleanValue(status) || 'Pending',
        plannedDate: cleanValue(planned),
        actualDate: cleanValue(actual),
        delay: cleanValue(delay) || '0'
      }
    })

    return transformedTasks
  }

  // Main function to fetch tasks
  const fetchTasks = async () => {
    if (!party || !stage) {
      setTasks([])
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Get stage data
      const stageData = await makeRequest('getStageData', { stageName: stage.name })
      
      console.log('Fetching tasks for:', { party: party.name, stage: stage.name })
      console.log('Stage data received:', stageData.length, 'rows')
      
      let transformedTasks = []
      
      // Check if this is a horizontal category stage
      if (isHorizontalCategoryStage(stage.name)) {
        transformedTasks = await fetchHorizontalTasks(stageData)
      } else {
        transformedTasks = await fetchRegularTasks(stageData)
      }

      // Group tasks by Draft Category, but preserve column order for horizontal stages
      const groupedTasks = {}
      transformedTasks.forEach(task => {
        const category = task.draftCategory
        if (!groupedTasks[category]) {
          groupedTasks[category] = []
        }
        groupedTasks[category].push(task)
      })

      // Convert to flat array with category headers
      const finalTasks = []
      
      if (isHorizontalCategoryStage(stage.name)) {
        // For horizontal stages, sort categories by column order (not alphabetically)
        const sortedCategories = Object.keys(groupedTasks).sort((a, b) => {
          // Get the first task from each category to compare column orders
          const taskA = groupedTasks[a][0]
          const taskB = groupedTasks[b][0]
          
          // If tasks have columnOrder property, use it for sorting
          if (taskA.columnOrder !== undefined && taskB.columnOrder !== undefined) {
            return taskA.columnOrder - taskB.columnOrder
          }
          
          // Fallback to alphabetical if no column order
          return a.localeCompare(b)
        })
        
        console.log('Categories sorted by column order:', sortedCategories)
        
        sortedCategories.forEach(category => {
          const categoryTasks = groupedTasks[category]
          
          categoryTasks.forEach((task, index) => {
            finalTasks.push({
              ...task,
              isFirstInCategory: index === 0,
              categoryTaskCount: categoryTasks.length,
              displayCategory: index === 0 ? category : null
            })
          })
        })
      } else {
        // For regular stages, use alphabetical sorting
        Object.keys(groupedTasks).sort().forEach(category => {
          const categoryTasks = groupedTasks[category]
          
          categoryTasks.forEach((task, index) => {
            finalTasks.push({
              ...task,
              isFirstInCategory: index === 0,
              categoryTaskCount: categoryTasks.length,
              displayCategory: index === 0 ? category : null
            })
          })
        })
      }

      setTasks(finalTasks)
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch tasks when party or stage changes
  useEffect(() => {
    fetchTasks()
  }, [party, stage])

  // Get unique draft categories for dropdown suggestions
  const uniqueDraftCategories = useMemo(() => {
    const categories = [...new Set(tasks.map(task => task.draftCategory))]
    return categories.sort()
  }, [tasks])

  // Get unique task names for dropdown suggestions
  const uniqueTaskNames = useMemo(() => {
    const taskNames = [...new Set(tasks.map(task => task.name))]
    return taskNames.sort()
  }, [tasks])

  // Get unique statuses for dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(tasks.map(task => task.status))]
    return statuses.sort()
  }, [tasks])

  // Filtered suggestions for draft categories
  const filteredCategoryOptions = useMemo(() => {
    if (!draftCategoryFilter) return uniqueDraftCategories
    return uniqueDraftCategories.filter(category =>
      category.toLowerCase().includes(draftCategoryFilter.toLowerCase())
    )
  }, [uniqueDraftCategories, draftCategoryFilter])

  // Filtered suggestions for task names
  const filteredTaskNameOptions = useMemo(() => {
    if (!taskNameFilter) return uniqueTaskNames
    return uniqueTaskNames.filter(taskName =>
      taskName.toLowerCase().includes(taskNameFilter.toLowerCase())
    )
  }, [uniqueTaskNames, taskNameFilter])

  // Filter tasks based on filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesDraftCategory = draftCategoryFilter === '' || 
        task.draftCategory.toLowerCase().includes(draftCategoryFilter.toLowerCase())
      
      const matchesTaskName = taskNameFilter === '' || 
        task.name.toLowerCase().includes(taskNameFilter.toLowerCase())
      
      const matchesStatus = statusFilter === '' || task.status === statusFilter
      
      return matchesDraftCategory && matchesTaskName && matchesStatus
    })
  }, [tasks, draftCategoryFilter, taskNameFilter, statusFilter])

  // Clear all filters
  const clearFilters = () => {
    setDraftCategoryFilter("")
    setTaskNameFilter("")
    setStatusFilter("")
    setShowCategoryDropdown(false)
    setShowTaskNameDropdown(false)
  }

  const getStatusColor = (status) => {
    const statusLower = status.toString().toLowerCase()
    
    if (statusLower.includes('completed') || statusLower.includes('done') || statusLower.includes('finished')) {
      return "bg-green-100 text-green-800"
    } else if (statusLower.includes('progress') || statusLower.includes('ongoing') || statusLower.includes('working')) {
      return "bg-blue-100 text-blue-800"
    } else if (statusLower.includes('pending') || statusLower.includes('waiting') || statusLower.includes('not set')) {
      return "bg-yellow-100 text-yellow-800"
    } else {
      return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateValue) => {
    if (!dateValue || dateValue === '' || dateValue === '-' || dateValue === 'null') return "-"
    
    let date
    if (typeof dateValue === 'string') {
      date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        return dateValue
      }
    } else if (dateValue instanceof Date) {
      date = dateValue
    } else {
      return dateValue.toString()
    }
    
    return date.toLocaleDateString()
  }

  const formatDelay = (delayValue) => {
    if (!delayValue || delayValue === '' || delayValue === '-' || delayValue === 'null') return "0"
    
    const delay = parseFloat(delayValue) || 0
    return delay > 0 ? `+${delay}` : delay.toString()
  }

  // Handle clicking outside dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowCategoryDropdown(false)
        setShowTaskNameDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">Loading tasks...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center p-8">
        <div className="text-red-600 text-lg mb-4">Error: {error}</div>
        <button 
          onClick={fetchTasks}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!party || !stage) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select a party and stage to view tasks
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Tasks for {party.name} in {stage.name}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Showing {filteredTasks.length} of {tasks.length} tasks
          {isHorizontalCategoryStage(stage.name) && (
            <span className="ml-2 text-blue-600">(Horizontal Categories)</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Draft Category Filter with Dropdown */}
          <div className="flex-1 min-w-48 dropdown-container relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Draft Category
            </label>
            <input
              type="text"
              value={draftCategoryFilter}
              onChange={(e) => {
                setDraftCategoryFilter(e.target.value)
                setShowCategoryDropdown(true)
              }}
              onFocus={() => setShowCategoryDropdown(true)}
              placeholder="Search draft category..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            {/* Category Dropdown */}
            {showCategoryDropdown && filteredCategoryOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredCategoryOptions.map((category, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setDraftCategoryFilter(category)
                      setShowCategoryDropdown(false)
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900">{category}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task Name Filter with Dropdown */}
          <div className="flex-1 min-w-48 dropdown-container relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Task Name
            </label>
            <input
              type="text"
              value={taskNameFilter}
              onChange={(e) => {
                setTaskNameFilter(e.target.value)
                setShowTaskNameDropdown(true)
              }}
              onFocus={() => setShowTaskNameDropdown(true)}
              placeholder="Search task name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            {/* Task Name Dropdown */}
            {showTaskNameDropdown && filteredTaskNameOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredTaskNameOptions.map((taskName, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      setTaskNameFilter(taskName)
                      setShowTaskNameDropdown(false)
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900">{taskName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          <div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(draftCategoryFilter || taskNameFilter || statusFilter) && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {draftCategoryFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Category: "{draftCategoryFilter}"
                <button
                  onClick={() => setDraftCategoryFilter("")}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            {taskNameFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Task: "{taskNameFilter}"
                <button
                  onClick={() => setTaskNameFilter("")}
                  className="ml-1 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter("")}
                  className="ml-1 text-purple-600 hover:text-purple-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 bg-white shadow-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Draft Category</th>
              <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Task Name</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Planned Date</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Actual Date</th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Delay (Days)</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task, index) => (
              <tr key={task.id} className={`hover:bg-gray-50 ${task.isFirstInCategory ? 'border-t-2 border-blue-200' : ''}`}>
                <td className="border border-gray-300 px-4 py-2 bg-gray-50">
                  {task.displayCategory ? (
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">
                        {task.displayCategory}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {task.categoryTaskCount} task{task.categoryTaskCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="ml-4 text-gray-400 text-xs">
                      └ Subtask
                    </div>
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="font-medium text-gray-900">{task.name}</div>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                  {formatDate(task.plannedDate)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                  {formatDate(task.actualDate)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <span className={`font-semibold ${parseFloat(task.delay) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatDelay(task.delay)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredTasks.length === 0 && !loading && tasks.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-lg mb-2">No tasks match your filters</div>
            <div className="text-sm">
              Try adjusting your filters or <button 
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                clear all filters
              </button>
            </div>
          </div>
        )}
        
        {tasks.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-lg mb-2">No tasks found</div>
            <div className="text-sm">
              No tasks found for {party.name} in {stage.name}
            </div>
            <button 
              onClick={() => {
                console.log('Debug: Retrying with detailed logging')
                fetchTasks()
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry with Debug
            </button>
          </div>
        )}
      </div>
    </div>
  )
}