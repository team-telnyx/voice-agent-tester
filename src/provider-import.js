/**
 * External Provider to Telnyx Assistant Import Module
 *
 * Imports assistants from external providers (vapi, elevenlabs, retell)
 * into Telnyx using the Telnyx AI Assistants Import API.
 * 
 * Features:
 * - Auto-creates integration secrets from provider API keys
 * - Enables unauthenticated web calls for imported assistants
 */

const TELNYX_BASE_URL = 'https://api.telnyx.com/v2';
const TELNYX_SECRETS_ENDPOINT = `${TELNYX_BASE_URL}/integration_secrets`;
const TELNYX_IMPORT_ENDPOINT = `${TELNYX_BASE_URL}/ai/assistants/import`;
const TELNYX_ASSISTANTS_ENDPOINT = `${TELNYX_BASE_URL}/ai/assistants`;

// Supported providers
const SUPPORTED_PROVIDERS = ['vapi', 'elevenlabs', 'retell'];

// Default widget settings for benchmarking
const DEFAULT_WIDGET_SETTINGS = {
  theme: 'dark',
  audio_visualizer_config: {
    color: 'verdant',
    preset: 'roundBars'
  },
  start_call_text: '',
  default_state: 'expanded',
  position: 'fixed',
  view_history_url: null,
  report_issue_url: null,
  give_feedback_url: null,
  agent_thinking_text: '',
  speak_to_interrupt_text: '',
  logo_icon_url: null
};

/**
 * Create an integration secret in Telnyx from a provider's API key.
 *
 * @param {Object} options
 * @param {string} options.identifier - Unique identifier for the secret
 * @param {string} options.token - The API key/token to store
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @returns {Promise<{id: string, identifier: string}>}
 */
async function createIntegrationSecret({ identifier, token, telnyxApiKey }) {
  console.log(`🔐 Creating integration secret: ${identifier}`);

  const response = await fetch(TELNYX_SECRETS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: identifier,
      type: 'bearer',
      token: token
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create integration secret: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`✅ Integration secret created: ${data.data.identifier}`);
  
  return {
    id: data.data.id,
    identifier: data.data.identifier
  };
}

/**
 * Get assistant details from Telnyx API.
 *
 * @param {Object} options
 * @param {string} options.assistantId - The Telnyx assistant ID
 * @param {string} options.telnyxApiKey - Telnyx API key
 * @returns {Promise<Object>} - Assistant details
 */
export async function getAssistant({ assistantId, telnyxApiKey }) {
  const response = await fetch(`${TELNYX_ASSISTANTS_ENDPOINT}/${assistantId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get assistant: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // API returns data at root level for single assistant GET
  if (!data.id) {
    throw new Error(`Assistant not found: ${assistantId}`);
  }
  
  return data;
}

/**
 * Enable unauthenticated web calls for a Telnyx assistant.
 *
 * @param {Object} options
 * @param {string} options.assistantId - The Telnyx assistant ID
 * @param {string} options.telnyxApiKey - Telnyx API key
 * @param {Object} options.assistant - Optional existing assistant data to preserve settings
 * @returns {Promise<boolean>} - true if successful
 */
export async function enableWebCalls({ assistantId, telnyxApiKey, assistant }) {
  console.log(`🔧 Enabling unauthenticated web calls for assistant ${assistantId}...`);
  
  // Preserve existing telephony_settings and just enable web calls
  const telephonySettings = {
    ...(assistant?.telephony_settings || {}),
    supports_unauthenticated_web_calls: true
  };

  // Build request body preserving widget_settings if they exist
  const requestBody = {
    telephony_settings: telephonySettings
  };

  // Use existing widget_settings or set defaults
  if (assistant?.widget_settings && Object.keys(assistant.widget_settings).length > 0) {
    requestBody.widget_settings = assistant.widget_settings;
  } else {
    requestBody.widget_settings = DEFAULT_WIDGET_SETTINGS;
  }
  
  const response = await fetch(`${TELNYX_ASSISTANTS_ENDPOINT}/${assistantId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to enable web calls: ${response.status} ${errorText}`);
  }

  console.log(`✅ Unauthenticated web calls enabled`);
  return true;
}

/**
 * Sleep utility for retry delays.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Configure an imported assistant with web calls enabled, widget settings, and timestamped name.
 * Returns true if successful, false if failed (with warning).
 * 
 * Implements retry logic with exponential backoff to handle 404 errors that may occur
 * when the assistant was just created and is not yet available due to eventual consistency.
 *
 * @param {Object} options
 * @param {string} options.assistantId - The assistant ID
 * @param {string} options.assistantName - The original assistant name
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @param {string} options.provider - The provider name (for naming)
 * @returns {Promise<boolean>}
 */
async function configureImportedAssistant({ assistantId, assistantName, telnyxApiKey, provider }) {
  // Generate UTC timestamp suffix
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const providerLabel = provider ? `_${provider}` : '';
  const newName = `${assistantName || 'Imported'}${providerLabel}_${timestamp}`;
  
  console.log(`🔧 Configuring assistant: ${assistantId}`);
  console.log(`   📝 Renaming to: ${newName}`);

  // Retry configuration for handling 404 on recently created assistants
  const MAX_RETRIES = 5;
  const INITIAL_DELAY_MS = 500;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${TELNYX_ASSISTANTS_ENDPOINT}/${assistantId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${telnyxApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName,
          telephony_settings: {
            supports_unauthenticated_web_calls: true
          },
          widget_settings: DEFAULT_WIDGET_SETTINGS
        })
      });

      if (response.ok) {
        console.log(`✅ Assistant configured: ${newName}`);
        return true;
      }

      // Handle 404 with retry for recently created assistants
      if (response.status === 404 && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff: 500, 1000, 2000, 4000ms
        console.log(`   ⏳ Assistant not yet available (404), retrying in ${delay}ms... (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      // Non-retryable error or max retries exceeded
      const errorText = await response.text();
      console.warn(`⚠️  Could not configure assistant ${assistantId}: ${response.status}`);
      if (response.status === 404) {
        console.warn(`   Assistant not found after ${MAX_RETRIES} retries. It may take longer to propagate.`);
      }
      console.warn(`   This may require manual configuration in the Telnyx portal.`);
      return false;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`   ⏳ Network error, retrying in ${delay}ms... (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      console.warn(`⚠️  Error configuring assistant ${assistantId}: ${error.message}`);
      return false;
    }
  }
  
  return false;
}

/**
 * Import assistants from an external provider into Telnyx.
 * 
 * This function:
 * 1. Creates an integration secret from the provider's private API key
 * 2. Imports assistants from the provider (optionally filtered by ID)
 * 3. Enables unauthenticated web calls for each imported assistant
 *
 * @param {Object} options - Import options
 * @param {string} options.provider - External provider name (vapi, elevenlabs, retell)
 * @param {string} options.providerApiKey - The provider's private API key
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @param {string} [options.assistantId] - Optional: specific assistant ID to import
 * @returns {Promise<{assistants: Array<{id: string, name: string}>, assistantId: string}>}
 */
export async function importAssistantsFromProvider({ provider, providerApiKey, telnyxApiKey, assistantId }) {
  // Validate provider
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  console.log(`\n🔄 Importing assistants from ${provider} into Telnyx...`);

  try {
    // Step 1: Create integration secret from provider API key
    const secretIdentifier = `${provider}_import_${Date.now()}`;
    const secret = await createIntegrationSecret({
      identifier: secretIdentifier,
      token: providerApiKey,
      telnyxApiKey
    });

    // Step 2: Import assistant using the secret reference
    console.log(`📥 Importing assistant ${assistantId} using secret: ${secret.identifier}`);
    
    // Build import request body with specific assistant ID
    const importBody = {
      provider: provider,
      api_key_ref: secret.identifier,
      import_ids: [assistantId]
    };
    
    const importResponse = await fetch(TELNYX_IMPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(importBody)
    });

    if (!importResponse.ok) {
      const errorText = await importResponse.text();
      throw new Error(`Telnyx import API failed with status ${importResponse.status}: ${errorText}`);
    }

    const importData = await importResponse.json();
    const assistants = importData.data || [];

    if (assistants.length === 0) {
      throw new Error(`No assistant was imported for ID "${assistantId}"`);
    }

    // Validate that we got the correct assistant
    const importedAssistant = assistants[0];
    const importId = importedAssistant.import_metadata?.import_id;
    
    if (importId !== assistantId) {
      throw new Error(`Import mismatch: requested "${assistantId}" but got "${importId}"`);
    }

    // Check if this is a previously imported assistant (re-using existing Telnyx assistant)
    const importedAt = importedAssistant.import_metadata?.imported_at;
    const isReused = importedAt && (Date.now() - new Date(importedAt).getTime() > 60000); // More than 1 minute ago
    
    if (isReused) {
      console.log(`♻️  Re-using previously imported assistant: ${importedAssistant.name} (${importedAssistant.id})`);
      console.log(`   Originally imported at: ${importedAt}`);
    } else {
      console.log(`✅ Successfully imported: ${importedAssistant.name} (${importedAssistant.id})`);
      
      // Only configure newly imported assistants (rename with timestamp, enable web calls, set widget settings)
      console.log(`\n🔧 Configuring imported assistant...`);
      
      await configureImportedAssistant({
        assistantId: importedAssistant.id,
        assistantName: importedAssistant.name,
        telnyxApiKey,
        provider
      });
    }

    return {
      assistants: [{ 
        id: importedAssistant.id, 
        name: importedAssistant.name,
        import_id: importId 
      }],
      assistantId: importedAssistant.id
    };
  } catch (error) {
    console.error(`❌ Failed to import assistants from ${provider}:`, error.message);
    throw error;
  }
}

// Export supported providers for CLI validation
export { SUPPORTED_PROVIDERS };
