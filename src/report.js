import fs from 'fs';
import path from 'path';

export class ReportGenerator {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.allRunsData = [];
    // Map: "app|scenario|repetition" -> { metadata, stepMetrics, startTime }
    this.runs = new Map();
    this.stepColumns = new Map(); // Map of stepIndex -> Map of metricName -> column name
  }

  // Create a unique key for each run
  _getRunKey(appName, scenarioName, repetition) {
    return `${appName}|${scenarioName}|${repetition}`;
  }

  beginRun(appName, scenarioName, repetition) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    this.runs.set(key, {
      metadata: {
        app: appName,
        scenario: scenarioName,
        repetition: repetition,
        startTime: Date.now()
      },
      stepMetrics: new Map() // Map of stepIndex -> Map of metricName -> value
    });
  }

  recordStepMetric(appName, scenarioName, repetition, stepIndex, action, name, value, scenarioStepIndex = null) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    const run = this.runs.get(key);

    if (!run) {
      console.warn(`Warning: Attempting to record metric for non-existent run: ${key}`);
      return;
    }

    // Initialize step metrics map if it doesn't exist
    if (!run.stepMetrics.has(stepIndex)) {
      run.stepMetrics.set(stepIndex, new Map());
    }

    // Record the metric value
    run.stepMetrics.get(stepIndex).set(name, value);

    // Track column names based on step index, action, and metric name
    if (!this.stepColumns.has(stepIndex)) {
      this.stepColumns.set(stepIndex, new Map());
    }
    if (!this.stepColumns.get(stepIndex).has(name)) {
      this.stepColumns.get(stepIndex).set(name, `step_${stepIndex + 1}_${action}_${name}`);
    }

    // Track scenario step index for cross-provider comparison alignment
    if (scenarioStepIndex !== null) {
      if (!this.scenarioStepMap) {
        this.scenarioStepMap = new Map();
      }
      // Map absolute stepIndex -> scenarioStepIndex (1-based)
      this.scenarioStepMap.set(stepIndex, scenarioStepIndex);

      // Track scenario-based column names for comparison display
      if (!this.scenarioStepColumns) {
        this.scenarioStepColumns = new Map();
      }
      if (!this.scenarioStepColumns.has(scenarioStepIndex)) {
        this.scenarioStepColumns.set(scenarioStepIndex, new Map());
      }
      if (!this.scenarioStepColumns.get(scenarioStepIndex).has(name)) {
        this.scenarioStepColumns.get(scenarioStepIndex).set(name, `scenario_step_${scenarioStepIndex}_${action}_${name}`);
      }
    }
  }

  endRun(appName, scenarioName, repetition, success = true) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    const run = this.runs.get(key);

    if (!run) {
      console.warn(`Warning: Attempting to end non-existent run: ${key}`);
      return;
    }

    // Calculate duration
    const duration = Date.now() - run.metadata.startTime;

    // Deep copy the nested Map structure
    const runCopy = new Map();
    run.stepMetrics.forEach((metricsMap, stepIndex) => {
      runCopy.set(stepIndex, new Map(metricsMap));
    });

    this.allRunsData.push({
      metadata: {
        app: run.metadata.app,
        scenario: run.metadata.scenario,
        repetition: run.metadata.repetition,
        success: success ? 1 : 0,
        duration: duration
      },
      stepMetrics: runCopy
    });

    // Remove the run from active runs map
    this.runs.delete(key);
  }

  generateCSV() {
    if (this.allRunsData.length === 0) {
      console.warn('No step times recorded for report generation');
      return;
    }

    // Collect all step indices and their metrics
    const allStepMetrics = new Map(); // Map of stepIndex -> Set of metricNames
    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        if (!allStepMetrics.has(stepIndex)) {
          allStepMetrics.set(stepIndex, new Set());
        }
        metrics.forEach((_, metricName) => {
          allStepMetrics.get(stepIndex).add(metricName);
        });
      });
    });

    // Sort step indices
    const sortedStepIndices = Array.from(allStepMetrics.keys()).sort((a, b) => a - b);

    // Build column headers - start with app, scenario, repetition, success, and duration
    const headers = ['app', 'scenario', 'repetition', 'success', 'duration'];
    sortedStepIndices.forEach(stepIndex => {
      const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();
      metricNames.forEach(metricName => {
        const columnName = this.stepColumns.get(stepIndex)?.get(metricName) ||
                          `step_${stepIndex + 1}_${metricName}`;
        headers.push(columnName);
      });
    });

    // Create CSV data rows
    const dataRows = this.allRunsData.map(run => {
      // Start with metadata columns
      const row = [
        run.metadata.app,
        run.metadata.scenario,
        run.metadata.repetition,
        run.metadata.success,
        run.metadata.duration
      ];

      // Add step metrics
      sortedStepIndices.forEach(stepIndex => {
        const stepMetrics = run.stepMetrics.get(stepIndex) || new Map();
        const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();
        metricNames.forEach(metricName => {
          const value = stepMetrics.get(metricName);
          row.push(value !== undefined ? value : '');
        });
      });
      return row.join(', ');
    });

    const csvContent = `${headers.join(', ')}\n${dataRows.join('\n')}\n`;

    // Write to file
    fs.writeFileSync(this.filePath, csvContent, 'utf8');
    console.log(`Report generated: ${this.filePath}`);
  }

  generateMetricsSummary() {
    if (this.allRunsData.length === 0) {
      return;
    }

    console.log('\n=== METRICS SUMMARY ===');

    // Collect all step indices and their metrics
    const allStepMetrics = new Map(); // Map of stepIndex -> Set of metricNames
    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        if (!allStepMetrics.has(stepIndex)) {
          allStepMetrics.set(stepIndex, new Set());
        }
        metrics.forEach((_, metricName) => {
          allStepMetrics.get(stepIndex).add(metricName);
        });
      });
    });

    const sortedStepIndices = Array.from(allStepMetrics.keys()).sort((a, b) => a - b);

    if (sortedStepIndices.length === 0) {
      console.log('No metrics collected during test runs.');
      return;
    }

    sortedStepIndices.forEach(stepIndex => {
      const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();

      metricNames.forEach(metricName => {
        const columnName = this.stepColumns.get(stepIndex)?.get(metricName) ||
                          `step_${stepIndex + 1}_${metricName}`;
        const values = [];

        this.allRunsData.forEach(run => {
          const stepMetrics = run.stepMetrics.get(stepIndex);
          if (stepMetrics && stepMetrics.has(metricName)) {
            values.push(stepMetrics.get(metricName));
          }
        });

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const average = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);

          // Calculate p50 (median)
          const sortedValues = [...values].sort((a, b) => a - b);
          let p50;
          if (sortedValues.length % 2 === 0) {
            // Even number of samples: average of two middle values
            const mid1 = sortedValues[sortedValues.length / 2 - 1];
            const mid2 = sortedValues[sortedValues.length / 2];
            p50 = (mid1 + mid2) / 2;
          } else {
            // Odd number of samples: middle value
            p50 = sortedValues[Math.floor(sortedValues.length / 2)];
          }

          // Only add "ms" unit for elapsed_time metrics
          const unit = metricName === 'elapsed_time' ? 'ms' : '';
          const formatValue = (val) => unit ? `${Math.round(val)}${unit}` : val.toFixed(2);

          console.log(`${columnName}:`);
          console.log(`  Average: ${formatValue(average)}`);
          console.log(`  Min: ${formatValue(min)}`);
          console.log(`  Max: ${formatValue(max)}`);
          console.log(`  p50: ${formatValue(p50)}`);
          console.log('');
        }
      });
    });
  }

  /**
   * Get aggregated metrics by step for comparison.
   * Returns a Map of stepIndex -> { metricName -> { avg, min, max, p50 } }
   */
  getAggregatedMetrics() {
    const result = new Map();
    
    // Collect all step indices and their metrics
    const allStepMetrics = new Map();
    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        if (!allStepMetrics.has(stepIndex)) {
          allStepMetrics.set(stepIndex, new Set());
        }
        metrics.forEach((_, metricName) => {
          allStepMetrics.get(stepIndex).add(metricName);
        });
      });
    });

    allStepMetrics.forEach((metricNames, stepIndex) => {
      const stepResult = new Map();
      
      metricNames.forEach(metricName => {
        const values = [];
        this.allRunsData.forEach(run => {
          const stepMetrics = run.stepMetrics.get(stepIndex);
          if (stepMetrics && stepMetrics.has(metricName)) {
            values.push(stepMetrics.get(metricName));
          }
        });

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          const sortedValues = [...values].sort((a, b) => a - b);
          let p50;
          if (sortedValues.length % 2 === 0) {
            p50 = (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2;
          } else {
            p50 = sortedValues[Math.floor(sortedValues.length / 2)];
          }

          const columnName = this.stepColumns.get(stepIndex)?.get(metricName) ||
                            `step_${stepIndex + 1}_${metricName}`;

          stepResult.set(metricName, { avg, min, max, p50, columnName });
        }
      });
      
      result.set(stepIndex, stepResult);
    });

    return result;
  }

  /**
   * Get aggregated metrics keyed by scenario step index for cross-provider comparison.
   * Returns a Map of scenarioStepIndex -> { metricName -> { avg, min, max, p50, columnName } }
   */
  getAggregatedMetricsByScenarioStep() {
    const result = new Map();

    // Build reverse map: absolute stepIndex -> scenarioStepIndex
    const scenarioStepMap = this.scenarioStepMap || new Map();

    // Collect values grouped by scenarioStepIndex
    const grouped = new Map(); // scenarioStepIndex -> metricName -> values[]

    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        const scenarioIdx = scenarioStepMap.get(stepIndex);
        if (scenarioIdx == null) return; // skip steps without scenario mapping

        if (!grouped.has(scenarioIdx)) {
          grouped.set(scenarioIdx, new Map());
        }

        metrics.forEach((value, metricName) => {
          if (!grouped.get(scenarioIdx).has(metricName)) {
            grouped.get(scenarioIdx).set(metricName, []);
          }
          grouped.get(scenarioIdx).get(metricName).push(value);
        });
      });
    });

    grouped.forEach((metricMap, scenarioIdx) => {
      const stepResult = new Map();

      metricMap.forEach((values, metricName) => {
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);

          const sortedValues = [...values].sort((a, b) => a - b);
          let p50;
          if (sortedValues.length % 2 === 0) {
            p50 = (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2;
          } else {
            p50 = sortedValues[Math.floor(sortedValues.length / 2)];
          }

          const columnName = this.scenarioStepColumns?.get(scenarioIdx)?.get(metricName) ||
                            `scenario_step_${scenarioIdx}_${metricName}`;

          stepResult.set(metricName, { avg, min, max, p50, columnName });
        }
      });

      result.set(scenarioIdx, stepResult);
    });

    return result;
  }

  /**
   * Generate a comparison summary between two providers.
   * Aligns metrics by scenario step index so that identical scenario steps
   * are compared regardless of different application setup steps.
   * @param {ReportGenerator} providerReport - Report from the provider benchmark
   * @param {ReportGenerator} telnyxReport - Report from the Telnyx benchmark
   * @param {string} providerName - Name of the external provider
   */
  static generateComparisonSummary(providerReport, telnyxReport, providerName) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON SUMMARY: ' + providerName.toUpperCase() + ' vs TELNYX');
    console.log('='.repeat(80));

    // Use scenario-step-aligned metrics for comparison
    const providerMetrics = providerReport.getAggregatedMetricsByScenarioStep();
    const telnyxMetrics = telnyxReport.getAggregatedMetricsByScenarioStep();

    // Find all unique scenario step indices from both reports
    const allScenarioSteps = new Set([
      ...providerMetrics.keys(),
      ...telnyxMetrics.keys()
    ]);
    const sortedIndices = Array.from(allScenarioSteps).sort((a, b) => a - b);

    if (sortedIndices.length === 0) {
      console.log('No metrics available for comparison.');
      return;
    }

    // Compare elapsed_time metrics (primary latency indicator)
    console.log('\n📈 Latency Comparison (elapsed_time):');
    console.log('-'.repeat(80));
    console.log(
      'Metric'.padEnd(40) + 
      providerName.padEnd(12) + 
      'Telnyx'.padEnd(12) + 
      'Delta'.padEnd(16) + 
      'Winner'
    );
    console.log('-'.repeat(80));

    let measurementIndex = 0;
    sortedIndices.forEach(scenarioStep => {
      const providerStep = providerMetrics.get(scenarioStep);
      const telnyxStep = telnyxMetrics.get(scenarioStep);

      const providerElapsed = providerStep?.get('elapsed_time');
      const telnyxElapsed = telnyxStep?.get('elapsed_time');

      if (providerElapsed || telnyxElapsed) {
        measurementIndex++;

        // Use a user-friendly label instead of raw step numbers
        const action = (providerElapsed?.columnName || telnyxElapsed?.columnName || '').replace(/^scenario_step_\d+_/, '');
        const label = `Response #${measurementIndex} (${action})`;
        const shortLabel = label.length > 38 ? label.substring(0, 35) + '...' : label;
        
        const providerAvg = providerElapsed ? Math.round(providerElapsed.avg) : '-';
        const telnyxAvg = telnyxElapsed ? Math.round(telnyxElapsed.avg) : '-';
        
        let delta = '-';
        let winner = '-';
        
        if (providerElapsed && telnyxElapsed) {
          const diff = telnyxElapsed.avg - providerElapsed.avg;
          const pct = ((diff / providerElapsed.avg) * 100).toFixed(1);
          delta = diff > 0 ? `+${Math.round(diff)}ms` : `${Math.round(diff)}ms`;
          
          if (Math.abs(diff) < 50) {
            winner = '≈ Tie';
          } else if (diff < 0) {
            winner = '🏆 Telnyx';
          } else {
            winner = `🏆 ${providerName}`;
          }
          delta += ` (${pct}%)`;
        }

        console.log(
          shortLabel.padEnd(40) + 
          `${providerAvg}ms`.padEnd(12) + 
          `${telnyxAvg}ms`.padEnd(12) + 
          delta.padEnd(16) + 
          winner
        );
      }
    });

    console.log('-'.repeat(80));

    // Summary
    let providerTotal = 0, telnyxTotal = 0, comparableSteps = 0;
    sortedIndices.forEach(scenarioStep => {
      const providerStep = providerMetrics.get(scenarioStep);
      const telnyxStep = telnyxMetrics.get(scenarioStep);
      const providerElapsed = providerStep?.get('elapsed_time');
      const telnyxElapsed = telnyxStep?.get('elapsed_time');
      
      if (providerElapsed && telnyxElapsed) {
        providerTotal += providerElapsed.avg;
        telnyxTotal += telnyxElapsed.avg;
        comparableSteps++;
      }
    });

    if (comparableSteps > 0) {
      const totalDiff = telnyxTotal - providerTotal;
      const totalPct = ((totalDiff / providerTotal) * 100).toFixed(1);
      
      console.log('\n📊 Overall Summary:');
      console.log(`   Compared ${comparableSteps} matched response latencies`);
      console.log(`   ${providerName} total latency: ${Math.round(providerTotal)}ms`);
      console.log(`   Telnyx total latency: ${Math.round(telnyxTotal)}ms`);
      console.log(`   Difference: ${totalDiff > 0 ? '+' : ''}${Math.round(totalDiff)}ms (${totalPct}%)`);
      
      if (Math.abs(totalDiff) < 100) {
        console.log('\n   🤝 Result: Both providers perform similarly');
      } else if (totalDiff < 0) {
        console.log('\n   🏆 Result: Telnyx is faster overall');
      } else {
        console.log(`\n   🏆 Result: ${providerName} is faster overall`);
      }
    } else {
      console.log('\n⚠️  No comparable metrics found between providers.');
    }

    console.log('\n' + '='.repeat(80));
  }
}