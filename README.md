# AMQP Client Scanners

This repository houses the AMQP message consumers (workers) responsible for performing various security and infrastructure scans.

## Overview

The project is structured as a mono-repo containing multiple decoupled scanning services:
- **`port-scanner`**: A Node.js worker that integrates with tools like Nmap to scan open ports and services.
- **`domain-scanner`**: A Node.js worker that scans domains, collects SSL/TLS information, and performs related domain analysis.

Each scanner is organized into modular subdirectories:
- `db/`: Database connection and queries.
- `messaging/`: AMQP (RabbitMQ) consumer setup.
- `services/`: Core logic (AI, Nmap, Graph Data, SSL).
- `tools/`: Main scanner orchestrators.

Additionally, a `shared/` directory at the root provides shared utilities (like AI model fallback logic) used across multiple scanners.

## Development & AI Guidelines
Please refer to [agent.md](file:///c:/resume_project/amqp-client/agent.md) for the rules and constraints governing AI contributions to this repository.

## Getting Started

### Prerequisites
- **Node.js** (v20+ recommended)
- **RabbitMQ** server running locally or remotely
- **Nmap**: The `port-scanner` requires the `nmap` CLI tool to be installed on your system.
  - **Ubuntu/Debian**: `sudo apt-get install nmap`
  - **MacOS**: `brew install nmap`
  - **Windows**: Download the installer from [nmap.org/download](https://nmap.org/download.html)

### Installation
Each scanner is an independent Node.js project. To run them locally, navigate into their respective directories and install the dependencies.

```bash
cd port-scanner
npm install

cd ../domain-scanner
npm install
```
