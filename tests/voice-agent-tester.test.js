import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { VoiceAgentTester } from '../src/voice-agent-tester.js';
import { ReportGenerator } from '../src/report.js';
import fs from 'fs';
import path from 'path';

describe('VoiceAgentTester', () => {
  let tester;

  beforeEach(() => {
    tester = new VoiceAgentTester({ 
      verbose: false, 
      headless: true 
    });
  });

  afterEach(async () => {
    if (tester) {
      await tester.close();
    }
  });

  test('should create instance with default options', () => {
    const defaultTester = new VoiceAgentTester();
    expect(defaultTester.verbose).toBe(false);
    expect(defaultTester.headless).toBe(false);
    expect(defaultTester.browser).toBe(null);
    expect(defaultTester.page).toBe(null);
  });

  test('should create instance with custom options', () => {
    const customTester = new VoiceAgentTester({ 
      verbose: true, 
      headless: true 
    });
    expect(customTester.verbose).toBe(true);
    expect(customTester.headless).toBe(true);
  });

  test('should launch browser successfully', async () => {
    const testUrl = 'data:text/html,<html><body></body></html>';
    await tester.launch(testUrl);
    expect(tester.browser).not.toBe(null);
    expect(tester.page).not.toBe(null);
  });

  test('should close browser successfully', async () => {
    const testUrl = 'data:text/html,<html><body></body></html>';
    await tester.launch(testUrl);
    expect(tester.browser).not.toBe(null);

    await tester.close();
    expect(tester.browser).toBe(null);
    expect(tester.page).toBe(null);
  });

  test('should handle basic navigation', async () => {
    const testUrl = 'data:text/html,<html><body><h1>Test Page</h1></body></html>';
    await tester.launch(testUrl);

    // Navigate to a basic page
    await tester.page.goto(testUrl);

    const title = await tester.page.evaluate(() => document.querySelector('h1').textContent);
    expect(title).toBe('Test Page');
  });

  test('should execute click step', async () => {
    const testUrl = 'data:text/html,<html><body><button id="test-btn">Click Me</button><div id="result"></div></body></html>';
    await tester.launch(testUrl);

    // Navigate to the test page
    await tester.page.goto(testUrl);
    
    // Add click handler
    await tester.page.evaluate(() => {
      document.getElementById('test-btn').addEventListener('click', () => {
        document.getElementById('result').textContent = 'clicked';
      });
    });
    
    // Execute click step
    await tester.executeStep({
      action: 'click',
      selector: '#test-btn'
    }, 0, 'scenario');
    
    // Verify the click worked
    const result = await tester.page.evaluate(() => document.getElementById('result').textContent);
    expect(result).toBe('clicked');
  });

  test('should execute wait step', async () => {
    const testUrl = 'data:text/html,<html><body><div id="container"></div></body></html>';
    await tester.launch(testUrl);

    // Navigate to the test page
    await tester.page.goto(testUrl);
    
    // Add the element after a short delay
    await tester.page.evaluate(() => {
      setTimeout(() => {
        const newDiv = document.createElement('div');
        newDiv.id = 'delayed-element';
        newDiv.textContent = 'I appeared!';
        document.getElementById('container').appendChild(newDiv);
      }, 100);
    });
    
    // Execute wait step
    await tester.executeStep({
      action: 'wait',
      selector: '#delayed-element'
    }, 0, 'scenario');
    
    // Verify the element exists
    const element = await tester.page.$('#delayed-element');
    expect(element).not.toBe(null);
  });

  test('should handle speak step', async () => {
    const testUrl = 'data:text/html,<html><body><div id="speech-test"></div></body></html>';
    await tester.launch(testUrl);

    await tester.page.goto(testUrl);

    // Mock __speak to capture the speak call and publish speechend event after a small delay
    await tester.page.evaluate(() => {
      window.__speak = (text) => {
        document.getElementById('speech-test').textContent = text;
        // Signal speech end after a small delay to allow waitForAudioEvent to be set up
        setTimeout(() => {
          if (window.__publishEvent) {
            window.__publishEvent('speechend', {});
          }
        }, 10);
      };
    });

    await tester.executeStep({
      action: 'speak',
      text: 'Hello, this is a test'
    }, 0, 'scenario');

    // Verify speech was triggered
    const speechText = await tester.page.evaluate(() => document.getElementById('speech-test').textContent);
    expect(speechText).toBe('Hello, this is a test');
  });

  test('should handle unknown action gracefully', async () => {
    const testUrl = 'data:text/html,<html><body></body></html>';
    await tester.launch(testUrl);
    await tester.page.goto(testUrl);
    
    // Mock console.log to capture the output
    const originalLog = console.log;
    let logMessages = [];
    console.log = (message) => {
      logMessages.push(message);
    };

    await tester.executeStep({
      action: 'unknown_action'
    }, 0, 'scenario');

    // Find the unknown action message
    const unknownActionMessage = logMessages.find(msg => msg.includes('Unknown action'));
    expect(unknownActionMessage).toBe('Unknown action: unknown_action');

    // Restore console.log
    console.log = originalLog;
  });

  test('should throw error for missing required parameters', async () => {
    const testUrl = 'data:text/html,<html><body></body></html>';
    await tester.launch(testUrl);
    await tester.page.goto(testUrl);
    
    // Test click without selector
    await expect(tester.executeStep({ action: 'click' }, 0, 'scenario'))
      .rejects.toThrow('No selector specified for click action');

    // Test wait without selector
    await expect(tester.executeStep({ action: 'wait' }, 0, 'scenario'))
      .rejects.toThrow('No selector specified for wait action');

    // Test speak without text
    await expect(tester.executeStep({ action: 'speak' }, 0, 'scenario'))
      .rejects.toThrow('No text or file specified for speak action');
  });
});

describe('ReportGenerator - Comparison Step Alignment', () => {
  test('should align metrics by scenario step index across providers with different app steps', () => {
    // Simulate: Vapi has 5 app steps, Telnyx has 3 app steps
    // Both share the same 7 scenario steps with metrics on scenario steps 4 and 7
    const providerReport = new ReportGenerator('/tmp/test_provider.csv');
    const telnyxReport = new ReportGenerator('/tmp/test_telnyx.csv');

    // Provider (Vapi): 5 app steps + 7 scenario steps = 12 total
    // Metric steps at absolute indices 8 (scenario step 4) and 11 (scenario step 7)
    providerReport.beginRun('vapi', 'appointment', 0);
    providerReport.recordStepMetric('vapi', 'appointment', 0, 8, 'wait_for_voice', 'elapsed_time', 2849, 4);
    providerReport.recordStepMetric('vapi', 'appointment', 0, 11, 'wait_for_voice', 'elapsed_time', 3307, 7);
    providerReport.endRun('vapi', 'appointment', 0);

    // Telnyx: 3 app steps + 7 scenario steps = 10 total
    // Metric steps at absolute indices 6 (scenario step 4) and 9 (scenario step 7)
    telnyxReport.beginRun('telnyx', 'appointment', 0);
    telnyxReport.recordStepMetric('telnyx', 'appointment', 0, 6, 'wait_for_voice', 'elapsed_time', 1552, 4);
    telnyxReport.recordStepMetric('telnyx', 'appointment', 0, 9, 'wait_for_voice', 'elapsed_time', 704, 7);
    telnyxReport.endRun('telnyx', 'appointment', 0);

    // Get scenario-aligned metrics
    const providerMetrics = providerReport.getAggregatedMetricsByScenarioStep();
    const telnyxMetrics = telnyxReport.getAggregatedMetricsByScenarioStep();

    // Both should have metrics at scenario steps 4 and 7
    expect(providerMetrics.has(4)).toBe(true);
    expect(providerMetrics.has(7)).toBe(true);
    expect(telnyxMetrics.has(4)).toBe(true);
    expect(telnyxMetrics.has(7)).toBe(true);

    // Verify values are correct
    expect(providerMetrics.get(4).get('elapsed_time').avg).toBe(2849);
    expect(providerMetrics.get(7).get('elapsed_time').avg).toBe(3307);
    expect(telnyxMetrics.get(4).get('elapsed_time').avg).toBe(1552);
    expect(telnyxMetrics.get(7).get('elapsed_time').avg).toBe(704);

    // The comparison should now have 2 comparable steps (not 4 separate unmatched ones)
    const allScenarioSteps = new Set([
      ...providerMetrics.keys(),
      ...telnyxMetrics.keys()
    ]);
    expect(allScenarioSteps.size).toBe(2);
  });

  test('should generate comparison summary without errors', () => {
    const providerReport = new ReportGenerator('/tmp/test_provider.csv');
    const telnyxReport = new ReportGenerator('/tmp/test_telnyx.csv');

    providerReport.beginRun('vapi', 'appointment', 0);
    providerReport.recordStepMetric('vapi', 'appointment', 0, 8, 'wait_for_voice', 'elapsed_time', 2849, 4);
    providerReport.recordStepMetric('vapi', 'appointment', 0, 11, 'wait_for_voice', 'elapsed_time', 3307, 7);
    providerReport.endRun('vapi', 'appointment', 0);

    telnyxReport.beginRun('telnyx', 'appointment', 0);
    telnyxReport.recordStepMetric('telnyx', 'appointment', 0, 6, 'wait_for_voice', 'elapsed_time', 1552, 4);
    telnyxReport.recordStepMetric('telnyx', 'appointment', 0, 9, 'wait_for_voice', 'elapsed_time', 704, 7);
    telnyxReport.endRun('telnyx', 'appointment', 0);

    // Capture console output
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);

    ReportGenerator.generateComparisonSummary(providerReport, telnyxReport, 'vapi');

    console.log = originalLog;

    // Should contain comparison rows with both providers having values
    const output = logs.join('\n');
    expect(output).toContain('Response #1');
    expect(output).toContain('Response #2');
    expect(output).toContain('2849ms');
    expect(output).toContain('1552ms');
    expect(output).toContain('3307ms');
    expect(output).toContain('704ms');
    // Should contain delta and winner (both should show Telnyx winning)
    expect(output).toContain('🏆 Telnyx');
    // Should NOT contain unmatched '-ms' entries
    expect(output).not.toContain('-ms');
  });

  test('getAggregatedMetricsByScenarioStep returns empty map when no scenario steps', () => {
    const report = new ReportGenerator('/tmp/test.csv');
    report.beginRun('test', 'scenario', 0);
    // Record without scenarioStepIndex (app step)
    report.recordStepMetric('test', 'scenario', 0, 0, 'click', 'elapsed_time', 100);
    report.endRun('test', 'scenario', 0);

    const metrics = report.getAggregatedMetricsByScenarioStep();
    expect(metrics.size).toBe(0);
  });
});