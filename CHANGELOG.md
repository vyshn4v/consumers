# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Repository documentation framework (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`).
- `agent.md` context file for AI behavior guidelines and boundaries.
- Common `shared/` directory to house logic shared across scanners (e.g., AI fallback handler).
- Ability to pass custom Nmap `scanOptions` via message payload in `port-scanner`.

### Changed
- Reorganized `port-scanner` and `domain-scanner` into structural subdirectories (`db/`, `services/`, `tools/`, `messaging/`) for better modularity.
- Extracted repetitive DB query strings (`updateScanStatus`, `saveScanResult`) from `amqp-setup.js` into their respective `db.setup.js` files to strictly adhere to DRY.
- Centralized Gemini API call logic and model fallback mechanics into `shared/ai-helper.js`.
- Separated Zod and JSON validation schemas from `ai-service.js` into dedicated `ai-schema.js` modules.

### Fixed
- Fixed duplicate flag injection into Nmap arguments by utilizing a `Set` for parsing `scanOptions`.
