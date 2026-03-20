# Voice Agent Tester

[![CI](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telnyx/voice-agent-tester.svg)](https://www.npmjs.com/package/@telnyx/voice-agent-tester)

Automated benchmarking CLI that compares **Vapi** voice agents against **Telnyx**. Import your Vapi assistant into Telnyx, run the same test scenario on both platforms, and get a side-by-side latency report.

## Quick Start

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

## How It Works

1. **Import** — Your Vapi assistant is imported into Telnyx via the Import API
2. **Phase 1: Vapi Direct** — Runs the test scenario on Vapi's native widget
3. **Phase 2: Telnyx Import** — Runs the same scenario on the Telnyx-imported assistant
4. **Report** — Produces a side-by-side comparison with latency deltas and a winner per response

```
📊 COMPARISON: VAPI vs TELNYX
================================================================================

   Average response latency (2 matched responses):

   vapi             2849ms
   Telnyx           1552ms
   Difference       -1297ms (-45.5%)

   🏆 Telnyx is 45.5% faster

================================================================================
```

## Where to Find Your Keys

| Key | Where to find it |
|-----|------------------|
| `--api-key` | [Telnyx Portal → API Keys](https://portal.telnyx.com/#/app/api-keys) |
| `--provider-api-key` | [Vapi Dashboard → Organization Settings](https://dashboard.vapi.ai/org/api-keys) |
| `--provider-import-id` | Vapi Dashboard → select your assistant → copy the assistant ID |
| `--share-key` | Vapi Dashboard → select assistant → click 🔗 link icon next to the assistant ID |

## Import Only (Skip Comparison)

Import your Vapi assistant into Telnyx without running the benchmark:

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

## Test Telnyx Directly

Benchmark a Telnyx assistant without comparison:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <TELNYX_ASSISTANT_ID>
```

## CLI Reference

| Option | Default | Description |
|--------|---------|-------------|
| `-a, --applications` | required | Application config path(s) or folder |
| `-s, --scenarios` | required | Scenario config path(s) or folder |
| `--provider` | | Set to `vapi` for comparison mode |
| `--api-key` | | Telnyx API key |
| `--provider-api-key` | | Vapi API key |
| `--provider-import-id` | | Vapi assistant ID to import |
| `--share-key` | | Vapi share key for comparison mode |
| `--assistant-id` | | Telnyx assistant ID (direct mode) |
| `--compare` | `true` | Run both Vapi + Telnyx benchmarks |
| `--no-compare` | | Import only, skip Vapi benchmark |
| `-d, --debug` | `false` | Detailed timeout diagnostics |
| `-v, --verbose` | `false` | Show browser console logs |
| `--headless` | `true` | Run browser in headless mode |
| `--repeat` | `1` | Repetitions per test combination |
| `-c, --concurrency` | `1` | Parallel test runs |
| `-r, --report` | | CSV report output path |
| `-p, --params` | | URL template params (`key=value,key2=value2`) |
| `--retries` | `0` | Retry failed runs |
| `--record` | `false` | Record video+audio (webm) |
| `--audio-url` | | URL to audio file played as mic input |
| `--audio-volume` | `1.0` | Audio input volume (0.0–1.0) |
| `--assets-server` | `http://localhost:3333` | Assets server URL |
| `--application-tags` | | Filter applications by tags |
| `--scenario-tags` | | Filter scenarios by tags |

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

## Background Noise Testing

Test how voice agents perform with ambient noise:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment_with_noise.yaml \
  --provider vapi \
  --share-key <VAPI_SHARE_KEY> \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <VAPI_API_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
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

## Debugging

Use `--debug` for detailed diagnostics including audio monitor state, WebRTC connections, and RTP stats:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider vapi \
  --share-key <VAPI_SHARE_KEY> \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <VAPI_API_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID> \
  --debug
```

## License

MIT
