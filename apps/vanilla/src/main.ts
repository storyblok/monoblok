import {  managementClient } from '@storyblok/management-client'
import './style.css'

const client = managementClient({
  token: import.meta.env.VITE_STORYBLOK_TOKEN!,
})

const singletonClient = managementClient()

console.log({
  client,
  singletonClient
})

const checkTokens = () => {
  const requiredTokens = ['VITE_STORYBLOK_TOKEN']
  return requiredTokens.filter(token => !import.meta.env[token])
}

const missingTokens = checkTokens()
const tokenWarning = missingTokens.length > 0 
  ? `<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded">
      <p class="font-bold">Warning: Missing API Tokens</p>
      <p>The following environment variables are missing: ${missingTokens.join(', ')}</p>
      <p>Please add them to your .env file to use all features.</p>
    </div>`
  : ''

const getSpace = async () => {
  try {
    const response = await client.request('spaces/295017', {
      method: 'PUT',
      body: JSON.stringify({
        space: {
          name: 'Test Space'
        }
      })
    })
    console.log(response)
  } catch (error) {
    console.error(error)
  }
}


// Create UI with buttons for different API calls
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="max-w-3xl mx-auto p-8">
    <h1 class="text-3xl font-bold text-center text-purple-500 mb-8">Storyblok Playground</h1>
    ${tokenWarning}
    <div class="flex gap-4 justify-center mb-8">
      <button id="get-space" class="!bg-purple-500 hover:!bg-purple-600 text-white font-semibold py-3 px-6 rounded">Get Space</button>
    </div>
    <div id="result" class="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-[500px]">
      <p class="p-4">Results will appear here...</p>
    </div>
  </div>
`

document.querySelector<HTMLButtonElement>('#get-space')!.addEventListener('click', getSpace)