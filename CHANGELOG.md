# Changelog

## [0.4.2](https://github.com/team-telnyx/voice-agent-tester/compare/v0.4.1...v0.4.2) (2026-02-23)

### Features

* add dashboard hints for Vapi and ElevenLabs comparison mode params ([#16](https://github.com/team-telnyx/voice-agent-tester/issues/16)) ([7fda40b](https://github.com/team-telnyx/voice-agent-tester/commit/7fda40b6971a968dde1fc1c3466662227a3bc77e))

### Chores

* improve event logs and comparison mode docs ([#17](https://github.com/team-telnyx/voice-agent-tester/issues/17)) ([24a9683](https://github.com/team-telnyx/voice-agent-tester/commit/24a968337a0b4a6c2d6baddd0aa507d5a87c9488))

## [0.4.1](https://github.com/team-telnyx/voice-agent-tester/compare/v0.4.0...v0.4.1) (2026-02-18)

### Features

* require provider-specific params for comparison mode ([#10](https://github.com/team-telnyx/voice-agent-tester/issues/10)) ([db9eb27](https://github.com/team-telnyx/voice-agent-tester/commit/db9eb273c139374a9f6358126113cab92f8f5b32))
* use Qwen/Qwen3-235B-A22B as model for imported assistants ([#11](https://github.com/team-telnyx/voice-agent-tester/issues/11)) ([3c4ed0a](https://github.com/team-telnyx/voice-agent-tester/commit/3c4ed0a14498833544f1797426b234585adcb49b))

### Bug Fixes

* add --no-git.requireUpstream to release-it in draft workflow ([#14](https://github.com/team-telnyx/voice-agent-tester/issues/14)) ([9553e65](https://github.com/team-telnyx/voice-agent-tester/commit/9553e65bdc6f0094853895da6b806befc5a898f6))
* use triggering user as git author and create PR for releases ([#13](https://github.com/team-telnyx/voice-agent-tester/issues/13)) ([8ebecba](https://github.com/team-telnyx/voice-agent-tester/commit/8ebecba1839985949e46bec457f327711f89138d))

## [0.4.0](https://github.com/team-telnyx/voice-agent-tester/compare/v0.3.0...v0.4.0) (2026-01-26)

### Features

* add audio input from URL for benchmark runs ([c347de8](https://github.com/team-telnyx/voice-agent-tester/commit/c347de83b8318827bac098bff4328502908ee981))
* add background noise benchmark with pre-mixed audio files ([9f64179](https://github.com/team-telnyx/voice-agent-tester/commit/9f6417936514451270c4d1bc929771446c366b08))

## [0.3.0](https://github.com/team-telnyx/voice-agent-tester/compare/v0.2.3...v0.3.0) (2026-01-23)

### Features

* add comparison benchmark mode for provider imports ([a6de0f4](https://github.com/team-telnyx/voice-agent-tester/commit/a6de0f43e8cfd469ddfcd031c0c05a002662e30a))

## [0.2.3](https://github.com/team-telnyx/voice-agent-tester/compare/v0.2.2...v0.2.3) (2026-01-21)

### Features

* resolve cli config files via npm cli usage ([2b12952](https://github.com/team-telnyx/voice-agent-tester/commit/2b1295284f7dff6f2a91df743b69f7905246d97b))

## [0.2.2](https://github.com/team-telnyx/voice-agent-tester/compare/v0.2.1...v0.2.2) (2026-01-20)

## [0.2.1](https://github.com/team-telnyx/voice-agent-tester/compare/v0.2.0...v0.2.1) (2026-01-20)

### Features

* update usage and docs ([70085c9](https://github.com/team-telnyx/voice-agent-tester/commit/70085c9dc2d6733fb01be6d432585c2306bfce1d))

## 0.2.0 (2026-01-16)

### Features

* add debug flag for diagnostic and increase timeout limit ([fb3874b](https://github.com/team-telnyx/voice-agent-tester/commit/fb3874b5531a5237757fe2e9f218a095d8cf6dee))
* add default telnyx widget options ([d62e74f](https://github.com/team-telnyx/voice-agent-tester/commit/d62e74f1e0bdacff49dab67595a866110be861a4))
* add dynamic params support ([57397f2](https://github.com/team-telnyx/voice-agent-tester/commit/57397f20c6aecafcf0aef89c1699ff6ebee2e839))
* add elevenlabs provider ([d605f22](https://github.com/team-telnyx/voice-agent-tester/commit/d605f2260d78755bbe1c4f64d8f283f2167cc194))
* add release process ([acbffc2](https://github.com/team-telnyx/voice-agent-tester/commit/acbffc23efdcd2aa325049b940a94c3dc09694bb))
* add vapi application along ([a712397](https://github.com/team-telnyx/voice-agent-tester/commit/a7123972de82df52d0b45126159b5afa32afabfd))
* add workflow files ([f950bcf](https://github.com/team-telnyx/voice-agent-tester/commit/f950bcf7cd80994e74158347c674a49baa338ca2))
* automatically create integration secret ([e043e5a](https://github.com/team-telnyx/voice-agent-tester/commit/e043e5a9dd2df9453bc6b1a872a29b93d62779cc))
* handle dynamic provider param fields requirements ([4bdc7b0](https://github.com/team-telnyx/voice-agent-tester/commit/4bdc7b0ff2a8049836552fc5f59b6ab2dbb28e17))
* initial benchmark setup for telnyx voice ai ([8233c96](https://github.com/team-telnyx/voice-agent-tester/commit/8233c963ba3f7fe933c0f97d14e7c07146f1faf4))
* make provider required ([48ad25d](https://github.com/team-telnyx/voice-agent-tester/commit/48ad25d8c92acbd375ae23feade69cb8deb7dd2c))
* refactor naming ([b6857d9](https://github.com/team-telnyx/voice-agent-tester/commit/b6857d95e48c247287b6ae1ef713c62b889a4b34))
* release prepare ([8b78136](https://github.com/team-telnyx/voice-agent-tester/commit/8b7813697f4dc25beef4e9f0153d74888783f3e2))
* remove unused code ([42e2908](https://github.com/team-telnyx/voice-agent-tester/commit/42e2908720335541733c0e5eef68bba88139293a))
* update benchmark providers ([55623ba](https://github.com/team-telnyx/voice-agent-tester/commit/55623ba713b9dbb4ddf0abcd51d3be58dc5d5b8a))
* update benchmarking setup ([8b7eb5d](https://github.com/team-telnyx/voice-agent-tester/commit/8b7eb5d7e97d24ddd010c440851e97cb29a166e9))
* update model on telnyx import for better latency ([bbe941f](https://github.com/team-telnyx/voice-agent-tester/commit/bbe941fc0c8acdb158c3275685027084431ab2ed))
* update parameters usage on provider choice ([8e2def5](https://github.com/team-telnyx/voice-agent-tester/commit/8e2def5f701e679ce6e9b8fcad2c71c57b96d372))
* update params ([62c79b0](https://github.com/team-telnyx/voice-agent-tester/commit/62c79b0f22b9729c6e4ae8b8defb4502fb85fa57))
* update params and logic on import ([03142fb](https://github.com/team-telnyx/voice-agent-tester/commit/03142fb143d9981c09298beff19408ab42825676))

### Bug Fixes

* update logs in benchmark app ([26a238d](https://github.com/team-telnyx/voice-agent-tester/commit/26a238ddf0077868da1d877b7d9e89b17b5f7b50))
