# Voice Agent Tester

[![CI](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telnyx/voice-agent-tester.svg)](https://www.npmjs.com/package/@telnyx/voice-agent-tester)

Automated benchmarking CLI for voice AI agents. Import your assistant from any provider, run identical test scenarios on both platforms, and get a side-by-side latency comparison.

Supports **Telnyx**, **ElevenLabs**, **Vapi**, and **Retell**.

## Compare Your Voice Agent Against Telnyx

The tool imports your assistant from an external provider into Telnyx, then runs the **same scenario** on both platforms and produces a head-to-head latency report:

```
📈 Latency Comparison (elapsed_time):
--------------------------------------------------------------------------------
Metric                                  vapi        Telnyx      Delta            Winner
--------------------------------------------------------------------------------
Response #1 (wait_for_voice_elapsed_time) 2849ms    1552ms      -1297ms (-45.5%) 🏆 Telnyx
Response #2 (wait_for_voice_elapsed_time) 3307ms    704ms       -2603ms (-78.7%) 🏆 Telnyx
--------------------------------------------------------------------------------

📊 Overall Summary:
   Compared 2 matched response latencies
   vapi total latency: 6156ms
   Telnyx total latency: 2256ms
   Difference: -3900ms (-63.3%)

   🏆 Result: Telnyx is faster overall
```

### Vapi vs Telnyx

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider vapi \
  --share-key <VAPI_SHARE_KEY> \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <VAPI_API_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
```

### ElevenLabs vs Telnyx

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider elevenlabs \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <ELEVENLABS_API_KEY> \
  --provider-import-id <ELEVENLABS_AGENT_ID>
```

### Retell vs Telnyx

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider retell \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <RETELL_API_KEY> \
  --provider-import-id <RETELL_AGENT_ID>
```

### How Comparison Works

1. **Import** — The assistant is imported from the external provider into Telnyx
2. **Phase 1: Provider Direct** — Runs the scenario on the provider's native widget
3. **Phase 2: Telnyx Import** — Runs the same scenario on the Telnyx-imported assistant
4. **Report** — Produces a side-by-side comparison with latency delta and winner per response

### Provider-Specific Keys

Some providers need an extra key to load their demo widget. If not passed via CLI, the tool prompts with instructions.

| Provider | Flag | Required? | How to find it |
|----------|------|-----------|----------------|
| Vapi | `--share-key` | Yes | Dashboard → select assistant → click 🔗 link icon next to the assistant ID |
| ElevenLabs | `--branch-id` | No | Dashboard → Agents → select agent → Publish dropdown → "Copy shareable link" |

### Import Only (Skip Comparison)

To import without running the provider benchmark:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider vapi \
  --no-compare \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <VAPI_API_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
```

## Quick Start

Run directly with npx (no installation required):

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <YOUR_ASSISTANT_ID>
```

Or install globally:

```bash
npm install -g @telnyx/voice-agent-tester
voice-agent-tester -a applications/telnyx.yaml -s scenarios/appointment.yaml --assistant-id <YOUR_ASSISTANT_ID>
```

## Provider Examples

### Telnyx

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID>
```

### ElevenLabs

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/elevenlabs.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <AGENT_ID>
```

### Vapi

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/vapi.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID>
```

## CLI Reference

| Option | Default | Description |
|--------|---------|-------------|
| `-a, --applications` | required | Application config path(s) or folder |
| `-s, --scenarios` | required | Scenario config path(s) or folder |
| `--assistant-id` | | Telnyx or provider assistant ID |
| `--api-key` | | Telnyx API key |
| `--provider` | | Import from provider (`vapi`, `elevenlabs`, `retell`) |
| `--provider-api-key` | | External provider API key |
| `--provider-import-id` | | Provider assistant/agent ID to import |
| `--share-key` | | Vapi share key for comparison mode |
| `--branch-id` | | ElevenLabs branch ID (optional) |
| `--compare` | `true` | Run provider direct + Telnyx import benchmarks |
| `--no-compare` | | Skip provider direct benchmark |
| `-d, --debug` | `false` | Detailed timeout diagnostics |
| `-v, --verbose` | `false` | Show browser console logs |
| `--headless` | `true` | Run browser in headless mode |
| `--repeat` | `1` | Repetitions per app+scenario combination |
| `-c, --concurrency` | `1` | Parallel test runs |
| `-r, --report` | | CSV report output path |
| `-p, --params` | | URL template params (`key=value,key2=value2`) |
| `--retries` | `0` | Retry failed runs |
| `--application-tags` | | Filter applications by tags |
| `--scenario-tags` | | Filter scenarios by tags |
| `--record` | `false` | Record video+audio (webm) |
| `--audio-url` | | URL to audio file played as input during run |
| `--audio-volume` | `1.0` | Audio input volume (0.0–1.0) |
| `--assets-server` | `http://localhost:3333` | Assets server URL |

## Bundled Configs

**Applications:**

| Config | Provider |
|--------|----------|
| `applications/telnyx.yaml` | Telnyx AI Widget |
| `applications/elevenlabs.yaml` | ElevenLabs |
| `applications/vapi.yaml` | Vapi |
| `applications/retell.yaml` | Retell |

**Scenarios:**

| Config | Description |
|--------|-------------|
| `scenarios/appointment.yaml` | Appointment booking test |
| `scenarios/appointment_with_noise.yaml` | Appointment with background crowd noise |

## Background Noise Testing

Test how voice agents perform with ambient noise by using pre-mixed audio files:

```bash
# With background noise
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment_with_noise.yaml \
  --assistant-id <ASSISTANT_ID>

# Without noise (same assistant, compare results)
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID>
```

### Custom Audio Input

Play any audio file from a URL as microphone input throughout the benchmark:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID> \
  --audio-url "https://example.com/test-audio.mp3" \
  --audio-volume 0.8
```

### Audio Assets

| File | Description |
|------|-------------|
| `hello_make_an_appointment.mp3` | Clean appointment request |
| `hello_make_an_appointment_with_noise.mp3` | Appointment request + crowd noise |
| `appointment_data.mp3` | Clean appointment details |
| `appointment_data_with_noise.mp3` | Appointment details + crowd noise |

## Scenario Configuration

Scenarios are YAML files with a sequence of steps. Steps with `metrics: elapsed_time` are included in the latency report.

```yaml
# scenarios/appointment.yaml
steps:
  - action: wait_for_voice        # Wait for agent greeting
  - action: wait_for_silence      # Wait for greeting to finish
  - action: speak
    file: hello_make_an_appointment.mp3
  - action: wait_for_voice        # ← Measured: time to first response
    metrics: elapsed_time
  - action: wait_for_silence
  - action: speak
    file: appointment_data.mp3
  - action: wait_for_voice        # ← Measured: time to second response
    metrics: elapsed_time
```

### Available Actions

| Action | Description |
|--------|-------------|
| `speak` | Play audio (`file`) or synthesize text (`text`) as microphone input |
| `wait_for_voice` | Wait for the AI agent to start speaking |
| `wait_for_silence` | Wait for the AI agent to stop speaking |
| `sleep` | Pause for a fixed duration (`time` in ms) |
| `click` | Click an element (`selector`) |
| `click_with_retry` | Click with retries and connection verification |
| `wait_for_element` | Wait for a DOM element to appear |
| `type` | Type text into an input field |
| `fill` | Set an input field value directly |
| `select` | Select dropdown/checkbox/radio option |
| `screenshot` | Capture a screenshot |
| `listen` | Record agent audio, transcribe, and evaluate |

## Debugging

If benchmarks fail or time out, use `--debug` for detailed diagnostics including audio monitor state, WebRTC connection info, and RTP stats:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID> \
  --debug
```

## License

MIT
