# Architecture

This document describes the high-level architecture of the AMQP client services in this repository.

## System Design

This repository follows a microservices/worker architecture using AMQP (e.g., RabbitMQ) for message brokering. The primary components are independent Node.js consumers that listen to specific queues, process the jobs, and interact with the database.

### 1. Port Scanner (`/port-scanner`)
- **Messaging (`/messaging`)**: Listens to AMQP queues for port scanning jobs via `amqp-setup.js`.
- **Scanning Logic (`/services`)**: Uses `nmap-service.js` for executing network port scans.
- **Analysis (`/services`)**: Leverages `ai-service.js` for interpreting the scan results.
- **Data Model (`/services`, `/db`)**: Uses `graph-service.js` for graph mapping and `db.setup.js` to store relationships between IPs, ports, and vulnerabilities.
- **Orchestration (`/tools`)**: Uses `tools.js` to string the services together.

### 2. Domain Scanner (`/domain-scanner`)
- **Messaging (`/messaging`)**: Listens to AMQP queues for domain analysis tasks (`amqp-setup.js`).
- **Scanning Logic (`/services`)**: Employs `ssl-service.js` to inspect domain configurations, SSL certificates, and TLS security.
- **Analysis (`/services`)**: Uses `ai-service.js` to analyze findings and detect anomalies.
- **Storage (`/db`)**: Uses `db.setup.js` for persistence.
- **Orchestration (`/tools`)**: Uses `scanner.js` to coordinate the scanning and AI execution.

## Data Flow
1. A master API or scheduler publishes a scan job to the RabbitMQ exchange.
2. The relevant worker (`port-scanner` or `domain-scanner`) consumes the message.
3. The worker executes the scan, analyzes the results using AI, and saves the data to the database.
4. The worker acknowledges the AMQP message upon successful completion.
