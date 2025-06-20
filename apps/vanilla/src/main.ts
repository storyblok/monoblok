import { contentClient } from '@storyblok/content-client';

import './style.css'

const capi =  contentClient({
  accessToken: import.meta.env.VITE_ACCESS_TOKEN as string,
  region: 'eu',
  version: 'draft',
})

// Function to check if tokens are available
const checkTokens = () => {
  const accessToken = import.meta.env.VITE_ACCESS_TOKEN as string
  const oauthToken = import.meta.env.VITE_OAUTH_TOKEN as string
  
  const missingTokens = []
  
  if (!accessToken) {
    missingTokens.push('VITE_ACCESS_TOKEN')
  }
  
  if (!oauthToken) {
    missingTokens.push('VITE_OAUTH_TOKEN')
  }
  
  return missingTokens
}

// Function to display results in the UI
const displayResult = (result: any) => {
  document.querySelector<HTMLDivElement>('#result')!.innerHTML = `
    <pre class="p-4 m-0 whitespace-pre-wrap">
      <code class="font-mono text-sm">
        ${JSON.stringify(result, null, 2)}
      </code>
    </pre>
  `
}

// Function to handle errors
const handleError = (error: any) => {
  console.error(error)
  document.querySelector<HTMLDivElement>('#result')!.innerHTML = `
    <pre class="p-4 m-0 whitespace-pre-wrap bg-red-100 text-red-600">
      <code class="font-mono text-sm">
        ${JSON.stringify(error, null, 2)}
      </code>
    </pre>
  `
}

// API call functions
/**
 * Fetches a specific story with draft version
 * @returns Promise with the story data
 */
const getStory = async () => {
  return await capi.get('/stories/home', {
    version: 'draft',
    resolveRelations: 'root.author',
  })
}

/**
 * Fetches all links with published version
 * @returns Promise with the links data
 */
const getAllLinks = async () => {
  return await capi.getAllLinks({
    version: 'published',
  })
}



// Check for missing tokens
const missingTokens = checkTokens()
const tokenWarning = missingTokens.length > 0 
  ? `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded">
      <p class="font-bold">Warning: Missing API Tokens</p>
      <p>The following environment variables are missing: ${missingTokens.join(', ')}</p>
      <p>Please add them to your .env file to use all features.</p>
    </div>`
  : ''

// Create UI with buttons for different API calls
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-3xl font-bold text-center text-purple-500 mb-8">Storyblok Client Playground</h1>
    ${tokenWarning}
    <div class="flex gap-4 justify-center mb-8">
      <button id="get-story" class="!bg-purple-500 hover:!bg-purple-600 text-white font-semibold py-3 px-6 rounded">Get Story</button>
      <button id="get-all-links" class="!bg-purple-500 hover:!bg-purple-600 text-white font-semibold py-3 px-6 rounded">Get All Links</button>
    </div>
    <div id="result" class="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-[500px]">
      <p class="p-4">Results will appear here...</p>
    </div>
  </div>
`

// Add event listeners to buttons
document.getElementById('get-story')?.addEventListener('click', async () => {
  try {
    const result = await getStory()
    displayResult(result)
  } catch (error) {
    handleError(error)
  }
})

document.getElementById('get-all-links')?.addEventListener('click', async () => {
  try {
    const links = await getAllLinks()
    displayResult(links)
  } catch (error) {
    handleError(error)
  }
})


