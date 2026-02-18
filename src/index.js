#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import YAML from 'yaml';
import { VoiceAgentTester } from './voice-agent-tester.js';
import { ReportGenerator } from './report.js';
import { createServer } from './server.js';
import { importAssistantsFromProvider, getAssistant, enableWebCalls, SUPPORTED_PROVIDERS } from './provider-import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __packageDir = path.resolve(__dirname, '..');

// Helper function to resolve file paths from comma-separated input or folder
// First tries to resolve relative to cwd, then falls back to package directory
function resolveConfigPaths(input) {
  const paths = [];
  const items = input.split(',').map(s => s.trim());

  for (const item of items) {
    // Try resolving relative to current working directory first
    let resolvedPath = path.resolve(item);
    
    // If not found in cwd, try resolving relative to package directory
    if (!fs.existsSync(resolvedPath)) {
      const packagePath = path.resolve(__packageDir, item);
      if (fs.existsSync(packagePath)) {
        resolvedPath = packagePath;
      }
    }

    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);

      if (stat.isDirectory()) {
        // If it's a directory, find all .yaml files
        const files = fs.readdirSync(resolvedPath)
          .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
          .map(f => path.join(resolvedPath, f));
        paths.push(...files);
      } else if (stat.isFile()) {
        paths.push(resolvedPath);
      }
    } else {
      throw new Error(`Path not found: ${item}`);
    }
  }

  return paths;
}

// Helper function to parse params string into an object
function parseParams(paramsString) {
  if (!paramsString) {
    return {};
  }

  const params = {};
  const pairs = paramsString.split(',');

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      params[key.trim()] = valueParts.join('=').trim();
    }
  }

  return params;
}

// Helper function to substitute template variables in URL
function substituteUrlParams(url, params) {
  if (!url) return url;

  let result = url;
  for (const [key, value] of Object.entries(params)) {
    // Replace {{key}} with value
    const templatePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(templatePattern, value);
  }

  return result;
}

// Helper function to load and validate application config
function loadApplicationConfig(configPath, params = {}) {
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = YAML.parse(configFile);

  if (!config.url && !config.html) {
    throw new Error(`Application config must contain "url" or "html" field: ${configPath}`);
  }

  // Substitute URL template params
  const url = substituteUrlParams(config.url, params);

  return {
    name: path.basename(configPath, path.extname(configPath)),
    path: configPath,
    url: url,
    html: config.html,
    steps: config.steps || [],
    tags: config.tags || []
  };
}

// Helper function to load scenario config
function loadScenarioConfig(configPath) {
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = YAML.parse(configFile);

  return {
    name: path.basename(configPath, path.extname(configPath)),
    path: configPath,
    steps: config.steps || [],
    tags: config.tags || []
  };
}

// Helper function to prompt user for y/n response
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

// Helper function to prompt user for text input
function promptUserInput(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('applications', {
    alias: 'a',
    type: 'string',
    description: 'Comma-separated application paths or folder path',
    demandOption: true
  })
  .option('scenarios', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated scenario paths or folder path',
    demandOption: true
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Show browser console logs',
    default: false
  })
  .option('assets-server', {
    type: 'string',
    description: 'Assets server URL',
    default: `http://localhost:${process.env.HTTP_PORT || process.env.PORT || 3333}`
  })
  .option('report', {
    alias: 'r',
    type: 'string',
    description: 'Generate CSV report with step elapsed times to specified file',
    default: null
  })
  .option('repeat', {
    type: 'number',
    description: 'Number of repetitions to run each app+scenario combination (closes and recreates browser for each)',
    default: 1
  })
  .option('headless', {
    type: 'boolean',
    description: 'Run browser in headless mode',
    default: true
  })
  .option('application-tags', {
    type: 'string',
    description: 'Comma-separated list of application tags to filter by',
    default: null
  })
  .option('scenario-tags', {
    type: 'string',
    description: 'Comma-separated list of scenario tags to filter by',
    default: null
  })
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    description: 'Number of tests to run in parallel',
    default: 1
  })
  .option('record', {
    type: 'boolean',
    description: 'Record video and audio of the test in webm format',
    default: false
  })
  .option('params', {
    alias: 'p',
    type: 'string',
    description: 'Comma-separated key=value pairs for URL template substitution (e.g., --params key=value)',
    default: null
  })
  .option('provider', {
    type: 'string',
    description: `Import from external provider (${SUPPORTED_PROVIDERS.join(', ')}) - requires --api-key, --provider-api-key, --provider-import-id`,
    choices: SUPPORTED_PROVIDERS
  })
  .option('api-key', {
    type: 'string',
    description: 'Telnyx API key for authentication and import operations'
  })
  .option('provider-api-key', {
    type: 'string',
    description: 'External provider API key (required with --provider for import)'
  })
  .option('provider-import-id', {
    type: 'string',
    description: 'Provider assistant/agent ID to import (required with --provider)'
  })
  .option('provider-public-key', {
    type: 'string',
    description: 'External provider public/browser API key for direct widget testing (required when comparison mode is enabled)'
  })
  .option('assistant-id', {
    type: 'string',
    description: 'Assistant/agent ID for direct benchmarking (works with all providers)'
  })
  .option('debug', {
    alias: 'd',
    type: 'boolean',
    description: 'Enable detailed timeout diagnostics for audio events',
    default: false
  })
  .option('compare', {
    type: 'boolean',
    description: 'Run both provider direct and Telnyx import benchmarks for comparison (requires --provider)',
    default: true
  })
  .option('no-compare', {
    type: 'boolean',
    description: 'Disable comparison benchmarks (run only Telnyx import)',
    default: false
  })
  .option('audio-url', {
    type: 'string',
    description: 'URL to audio file to play as input during entire benchmark run',
    default: null
  })
  .option('audio-volume', {
    type: 'number',
    description: 'Volume level for audio input (0.0 to 1.0)',
    default: 1.0
  })
  .help()
  .argv;

/**
 * Run a benchmark suite with specified configurations.
 * @param {Object} options - Benchmark options
 * @param {Array} options.applications - Application configs to run
 * @param {Array} options.scenarios - Scenario configs to run
 * @param {number} options.repeat - Number of repetitions
 * @param {number} options.concurrency - Concurrency level
 * @param {Object} options.argv - CLI arguments
 * @param {Array} options.tempHtmlPaths - Array to track temporary HTML files
 * @param {ReportGenerator} options.reportGenerator - Report generator instance
 * @param {string} options.label - Label for this benchmark run
 * @returns {Promise<{successful: number, failed: number, errors: Array}>}
 */
async function runBenchmark({ applications, scenarios, repeat, concurrency, argv, tempHtmlPaths, reportGenerator, label }) {
  const combinations = [];
  for (const app of applications) {
    for (const scenario of scenarios) {
      combinations.push({ app, scenario });
    }
  }

  const totalRuns = combinations.length * repeat;
  
  if (label) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🏁 ${label}`);
    console.log(`${'='.repeat(80)}`);
  }
  
  console.log(`\n📋 Loaded ${applications.length} application(s) and ${scenarios.length} scenario(s)`);
  console.log(`Applications: ${applications.map(a => a.name).join(', ')}`);
  console.log(`Scenarios: ${scenarios.map(s => s.name).join(', ')}`);
  console.log(`\n🎯 Running ${combinations.length} combination(s) × ${repeat} repetition(s) = ${totalRuns} total run(s)\n`);

  // Helper function to execute a single test run
  async function executeRun({ app, scenario, repetition, runNumber }) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📱 Application: ${app.name}`);
    console.log(`📝 Scenario: ${scenario.name}`);
    if (repeat > 1) {
      console.log(`🔁 Repetition: ${repetition}`);
    }
    console.log(`🏃 Run: ${runNumber}/${totalRuns}`);
    console.log(`${'='.repeat(80)}`);

    // Handle HTML content vs URL
    let targetUrl;
    let tempHtmlPath = null;

    if (app.html) {
      // Create temporary HTML file and serve it
      const assetsDir = path.join(__dirname, '..', 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      tempHtmlPath = path.join(assetsDir, `temp_${app.name}_${Date.now()}.html`);
      fs.writeFileSync(tempHtmlPath, app.html, 'utf8');
      tempHtmlPaths.push(tempHtmlPath);
      targetUrl = `${argv.assetsServer}/assets/${path.basename(tempHtmlPath)}`;
      console.log(`HTML content served at: ${targetUrl}`);
    } else {
      targetUrl = app.url;
      console.log(`URL: ${targetUrl}`);
    }

    // Application and scenario steps are executed separately
    console.log(`Total steps: ${app.steps.length + scenario.steps.length} (${app.steps.length} from app + ${scenario.steps.length} from suite)\n`);

    const tester = new VoiceAgentTester({
      verbose: argv.verbose,
      headless: argv.headless,
      assetsServerUrl: argv.assetsServer,
      reportGenerator: reportGenerator,
      record: argv.record,
      debug: argv.debug,
      audioUrl: argv.audioUrl,
      audioVolume: argv.audioVolume
    });

    try {
      await tester.runScenario(targetUrl, app.steps, scenario.steps, app.name, scenario.name, repetition);
      console.log(`✅ Completed successfully (Run ${runNumber}/${totalRuns})`);
      return { success: true };
    } catch (error) {
      // Store only the first line for summary, but print full message here (with diagnostics)
      const shortMessage = error.message.split('\n')[0];
      const errorInfo = {
        app: app.name,
        scenario: scenario.name,
        repetition,
        error: shortMessage
      };
      // Print full diagnostics here (only place they appear)
      console.error(`❌ Error (Run ${runNumber}/${totalRuns}):\n${error.message}`);
      return { success: false, error: errorInfo };
    }
  }

  // Build all test runs (combination x repetitions)
  const allRuns = [];
  let runNumber = 0;

  for (const { app, scenario } of combinations) {
    for (let i = 0; i < repeat; i++) {
      runNumber++;
      allRuns.push({
        app,
        scenario,
        repetition: i,
        runNumber
      });
    }
  }

  // Execute runs with concurrency limit using a worker pool
  const actualConcurrency = Math.min(concurrency, allRuns.length);
  console.log(`⚡ Concurrency level: ${actualConcurrency}`);

  // Worker pool implementation - start new tests as soon as one finishes
  const allResults = [];
  let nextRunIndex = 0;

  // Worker function that processes runs from the queue
  async function runWorker(workerId) {
    const workerResults = [];

    while (nextRunIndex < allRuns.length) {
      const runIndex = nextRunIndex++;
      const run = allRuns[runIndex];

      if (actualConcurrency > 1) {
        console.log(`\n👷 Worker ${workerId}: Starting run ${run.runNumber}/${totalRuns}`);
      }

      const result = await executeRun(run);
      workerResults.push(result);
    }

    return workerResults;
  }

  // Create a pool of worker promises
  const workers = [];
  for (let i = 0; i < actualConcurrency; i++) {
    workers.push(runWorker(i + 1));
  }

  // Wait for all workers to complete
  const workerResultArrays = await Promise.all(workers);

  // Flatten all worker results into a single array
  workerResultArrays.forEach(workerResults => {
    allResults.push(...workerResults);
  });

  // Aggregate results
  return {
    successful: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    errors: allResults.filter(r => !r.success).map(r => r.error),
    totalRuns
  };
}

async function main() {
  let server;
  let exitCode = 0;
  const tempHtmlPaths = [];

  try {
    // Start the assets server
    server = createServer();

    // Resolve application and scenario paths
    const applicationPaths = resolveConfigPaths(argv.applications);
    const scenarioPaths = resolveConfigPaths(argv.scenarios);

    if (applicationPaths.length === 0) {
      throw new Error('No application config files found');
    }

    if (scenarioPaths.length === 0) {
      throw new Error('No scenario config files found');
    }

    // Parse URL parameters for template substitution
    const params = parseParams(argv.params);
    
    // Determine if we should run comparison benchmark (may be updated later if public key is missing)
    let shouldCompare = argv.provider && argv.compare && !argv.noCompare;
    
    // Store credentials for potential comparison run
    let telnyxApiKey = argv.apiKey;
    let providerApiKey = argv.providerApiKey;
    let providerImportId = argv.providerImportId;
    let importedAssistantId = null;

    // Handle provider import if requested
    if (argv.provider) {
      // Prompt for missing required options for provider import
      if (!telnyxApiKey) {
        console.log(`\n🔑 Telnyx API key is required for importing from ${argv.provider}`);
        telnyxApiKey = await promptUserInput('Enter your Telnyx API key: ');
        if (!telnyxApiKey) {
          throw new Error('Telnyx API key is required for provider import');
        }
      }

      if (!providerApiKey) {
        console.log(`\n🔑 ${argv.provider} API key is required for importing`);
        providerApiKey = await promptUserInput(`Enter your ${argv.provider} API key: `);
        if (!providerApiKey) {
          throw new Error(`${argv.provider} API key is required for provider import`);
        }
      }

      if (!providerImportId) {
        console.log(`\n📋 ${argv.provider} assistant/agent ID is required for importing`);
        providerImportId = await promptUserInput(`Enter the ${argv.provider} assistant/agent ID to import: `);
        if (!providerImportId) {
          throw new Error(`${argv.provider} assistant/agent ID is required for provider import`);
        }
      }

      // Require provider public key when comparison mode is enabled
      if (shouldCompare && !argv.providerPublicKey) {
        console.log(`\n🔑 ${argv.provider} public/browser API key is required for comparison mode`);
        const inputKey = await promptUserInput(`Enter your ${argv.provider} public API key (or press Enter to skip comparison): `);
        if (inputKey) {
          argv.providerPublicKey = inputKey;
        } else {
          console.warn(`⚠️  No public key provided. Disabling comparison mode (--no-compare).`);
          console.warn(`   To run comparison benchmarks, pass --provider-public-key <key>\n`);
          argv.compare = false;
          argv.noCompare = true;
        }
      }

      // Re-evaluate shouldCompare after potential public key prompt
      shouldCompare = argv.provider && argv.compare && !argv.noCompare;

      const importResult = await importAssistantsFromProvider({
        provider: argv.provider,
        providerApiKey: providerApiKey,
        telnyxApiKey: telnyxApiKey,
        assistantId: providerImportId
      });

      // Use the imported assistant's Telnyx ID
      const selectedAssistant = importResult.assistants[0];

      // Inject the imported assistant ID into params (overrides CLI assistant-id with Telnyx ID)
      if (selectedAssistant) {
        params.assistantId = selectedAssistant.id;
        importedAssistantId = selectedAssistant.id;
        console.log(`📝 Injected Telnyx assistantId from ${argv.provider} import: ${selectedAssistant.id}`);
      }
    } else if (!argv.assistantId) {
      throw new Error('--assistant-id is required');
    } else {
      // Inject assistant-id into params for URL template substitution
      params.assistantId = argv.assistantId;
      // Direct Telnyx use case - optionally check web calls support if api-key provided
      if (argv.apiKey) {
        console.log(`\n🔍 Checking assistant configuration...`);
        try {
          const assistant = await getAssistant({
            assistantId: argv.assistantId,
            telnyxApiKey: argv.apiKey
          });

          const supportsWebCalls = assistant.telephony_settings?.supports_unauthenticated_web_calls;
          
          if (!supportsWebCalls) {
            console.log(`❌ Unauthenticated web calls: disabled`);
            console.warn(`\n⚠️  Warning: Assistant "${assistant.name}" does not support unauthenticated web calls.`);
            console.warn(`   The benchmark may not work correctly without this setting enabled.\n`);
            
            const shouldEnable = await promptUser('Would you like to enable unauthenticated web calls? (y/n): ');
            
            if (shouldEnable) {
              await enableWebCalls({
                assistantId: argv.assistantId,
                telnyxApiKey: argv.apiKey,
                assistant
              });
            } else {
              console.log('   Proceeding without enabling web calls...\n');
            }
          } else {
            console.log(`✅ Unauthenticated web calls: enabled`);
          }
        } catch (error) {
          console.log(`⚠️  Could not check assistant: ${error.message}`);
        }
      }
    }

    if (Object.keys(params).length > 0) {
      console.log(`📝 URL parameters: ${JSON.stringify(params)}`);
    }

    // Load scenario configs (shared across both benchmarks)
    let scenarios = scenarioPaths.map(loadScenarioConfig);

    // Filter scenarios by tags if specified
    if (argv.scenarioTags) {
      const filterTags = argv.scenarioTags.split(',').map(t => t.trim());
      scenarios = scenarios.filter(scenario =>
        scenario.tags.some(tag => filterTags.includes(tag))
      );
      if (scenarios.length === 0) {
        throw new Error(`No scenarios found with tags: ${filterTags.join(', ')}`);
      }
    }

    // Comparison benchmark mode: run provider direct, then Telnyx import
    if (shouldCompare) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 COMPARISON MODE: ${argv.provider.toUpperCase()} vs TELNYX`);
      console.log(`${'='.repeat(80)}`);
      console.log(`\nThis will run two benchmark phases:`);
      console.log(`  1. ${argv.provider.toUpperCase()} Direct - Using provider's native widget`);
      console.log(`  2. TELNYX Import - Using Telnyx-imported assistant`);
      console.log(`\nA comparison report will be generated at the end.\n`);

      // Create separate report generators for each phase
      const providerReportGenerator = new ReportGenerator(argv.report ? `provider_${argv.report}` : 'provider_metrics.csv');
      const telnyxReportGenerator = new ReportGenerator(argv.report ? `telnyx_${argv.report}` : 'telnyx_metrics.csv');

      // Phase 1: Provider Direct Benchmark
      // Load provider-specific application config with provider assistant ID
      const providerParams = { ...params, assistantId: providerImportId, providerApiKey: argv.providerPublicKey };
      const providerAppPath = path.resolve(__packageDir, 'applications', `${argv.provider}.yaml`);
      
      if (!fs.existsSync(providerAppPath)) {
        throw new Error(`Provider application config not found: ${providerAppPath}\nPlease create applications/${argv.provider}.yaml for direct provider benchmarking.`);
      }

      const providerApplications = [loadApplicationConfig(providerAppPath, providerParams)];
      
      const providerResults = await runBenchmark({
        applications: providerApplications,
        scenarios,
        repeat: argv.repeat || 1,
        concurrency: argv.concurrency || 1,
        argv,
        tempHtmlPaths,
        reportGenerator: providerReportGenerator,
        label: `PHASE 1: ${argv.provider.toUpperCase()} DIRECT BENCHMARK`
      });

      // Phase 2: Telnyx Import Benchmark  
      // Load Telnyx widget application config with imported assistant ID
      const telnyxParams = { ...params, assistantId: importedAssistantId };
      let telnyxApplications = applicationPaths.map(p => loadApplicationConfig(p, telnyxParams));

      // Filter applications by tags if specified
      if (argv.applicationTags) {
        const filterTags = argv.applicationTags.split(',').map(t => t.trim());
        telnyxApplications = telnyxApplications.filter(app =>
          app.tags.some(tag => filterTags.includes(tag))
        );
        if (telnyxApplications.length === 0) {
          throw new Error(`No applications found with tags: ${filterTags.join(', ')}`);
        }
      }

      const telnyxResults = await runBenchmark({
        applications: telnyxApplications,
        scenarios,
        repeat: argv.repeat || 1,
        concurrency: argv.concurrency || 1,
        argv,
        tempHtmlPaths,
        reportGenerator: telnyxReportGenerator,
        label: `PHASE 2: TELNYX IMPORT BENCHMARK`
      });

      // Generate individual metrics summaries
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 ${argv.provider.toUpperCase()} METRICS`);
      console.log(`${'='.repeat(80)}`);
      providerReportGenerator.generateMetricsSummary();

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 TELNYX METRICS`);
      console.log(`${'='.repeat(80)}`);
      telnyxReportGenerator.generateMetricsSummary();

      // Generate comparison report
      ReportGenerator.generateComparisonSummary(providerReportGenerator, telnyxReportGenerator, argv.provider);

      // Generate CSV reports if requested
      if (argv.report) {
        providerReportGenerator.generateCSV();
        telnyxReportGenerator.generateCSV();
      }

      // Print final summary
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 COMPARISON FINAL SUMMARY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`${argv.provider.toUpperCase()}: ✅ ${providerResults.successful}/${providerResults.totalRuns} successful`);
      console.log(`TELNYX: ✅ ${telnyxResults.successful}/${telnyxResults.totalRuns} successful`);

      const totalFailed = providerResults.failed + telnyxResults.failed;
      
      if (providerResults.failed > 0) {
        console.log(`\n🔍 ${argv.provider.toUpperCase()} Failures:`);
        providerResults.errors.forEach(({ app, scenario, repetition, error }) => {
          console.log(`  ${app} + ${scenario} (rep ${repetition}): ${error}`);
        });
      }

      if (telnyxResults.failed > 0) {
        console.log(`\n🔍 TELNYX Failures:`);
        telnyxResults.errors.forEach(({ app, scenario, repetition, error }) => {
          console.log(`  ${app} + ${scenario} (rep ${repetition}): ${error}`);
        });
      }

      if (totalFailed === 0) {
        console.log(`\n🎉 All comparison runs completed successfully!`);
      } else {
        console.log(`\n⚠️  Comparison completed with ${totalFailed} failure(s).`);
        
        // Suggest reissuing with debug if not already enabled
        if (!argv.debug) {
          console.log(`\n💡 Tip: For detailed diagnostics, rerun with --debug flag:`);
          console.log(`   voice-agent-tester --provider ${argv.provider} --debug [other options...]`);
        }
      }

      // Set exit code based on results
      if (totalFailed > 0) {
        exitCode = 1;
      }

    } else {
      // Standard single benchmark mode (no comparison)
      let applications = applicationPaths.map(p => loadApplicationConfig(p, params));

      // Filter applications by tags if specified
      if (argv.applicationTags) {
        const filterTags = argv.applicationTags.split(',').map(t => t.trim());
        applications = applications.filter(app =>
          app.tags.some(tag => filterTags.includes(tag))
        );
        if (applications.length === 0) {
          throw new Error(`No applications found with tags: ${filterTags.join(', ')}`);
        }
      }

      const reportGenerator = new ReportGenerator(argv.report || 'temp_metrics.csv');

      const results = await runBenchmark({
        applications,
        scenarios,
        repeat: argv.repeat || 1,
        concurrency: argv.concurrency || 1,
        argv,
        tempHtmlPaths,
        reportGenerator,
        label: null
      });

      // Generate the final report if requested, and always show metrics summary
      if (argv.report) {
        reportGenerator.generateCSV();
      }
      reportGenerator.generateMetricsSummary();

      // Print final summary
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 FINAL SUMMARY`);
      console.log(`${'='.repeat(80)}`);
      console.log(`✅ Successful runs: ${results.successful}/${results.totalRuns}`);

      if (results.failed > 0) {
        console.log(`\n🔍 Failure Details:`);
        results.errors.forEach(({ app, scenario, repetition, error }) => {
          console.log(`  ${app} + ${scenario} (rep ${repetition}): ${error}`);
        });
      }

      if (results.failed === 0) {
        console.log(`\n🎉 All runs completed successfully!`);
      } else {
        console.log(`\n⚠️  Completed with ${results.failed} failure(s).`);
        
        // Show helpful hint for direct Telnyx usage (when not using --provider)
        if (!argv.provider && argv.assistantId) {
          const editUrl = `https://portal.telnyx.com/#/login/sign-in?redirectTo=/ai/assistants/edit/${argv.assistantId}`;
          console.log(`\n💡 Tip: Make sure that the "Supports Unauthenticated Web Calls" option is enabled in your Telnyx assistant settings.`);
          console.log(`   Edit assistant: ${editUrl}`);
          console.log(`   Or provide --api-key to enable this setting automatically via CLI.`);
        }

        // Suggest reissuing with debug if not already enabled
        if (!argv.debug) {
          console.log(`\n💡 Tip: For detailed diagnostics, rerun with --debug flag.`);
        }
      }

      // Set exit code based on results
      if (results.failed > 0) {
        exitCode = 1;
      }
    }
  } catch (error) {
    console.error('Error running scenarios:', error.message);
    exitCode = 1;
  } finally {
    // Clean up temporary HTML files if created
    for (const tempHtmlPath of tempHtmlPaths) {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
    if (tempHtmlPaths.length > 0) {
      console.log('Temporary HTML files cleaned up');
    }

    // Close the server to allow process to exit
    if (server) {
      server.close(() => {
        console.log('Server closed');
        process.exit(exitCode);
      });
    } else {
      process.exit(exitCode);
    }
  }
}

main();