# AI Agent Guidelines (agent.md)

This document outlines the scope, rules, and best practices for AI agents operating in this project. The AI must strictly adhere to these instructions to ensure consistency and quality.

## Scope

### Technical

1. **Human-Understandable Code**: Code written by the AI should be clean, readable, and understandable by a human. It should be written in a style that is approachable for a junior-level developer. Avoid overly clever or obscure implementations that sacrifice clarity.
2. **Industrial Best Practices**: Consistently apply industry-standard coding practices, design patterns, and logic structure.
3. **Always Commit Changes**: The AI must always commit its changes (via `git`) once a task or logical unit of work is successfully completed and verified.
4. **Clean Repository & Secret Management**: Keep the repository clean. The AI must strictly avoid reading `.env` files or exposing sensitive information during its operations.
5. **Algorithmic Optimization**: Try to optimize the code using industry-level Data Structures and Algorithms (DSA) approaches, prioritizing efficiency without severely compromising the readability requirement (Rule 1).
6. **Semantic Git Commits**: When making git commits, use semantic commit messages (e.g., `feat`, `fix`, `chore`, `release`) and include the folder name in parentheses to clarify where the changes were made (e.g., `feat(components): add new button`).

### Non-Technical

1. **Continuous Testing for Security**: Rigorously test all functionality to ensure the application is secure and ready for production.
2. **Avoid Hallucination**: If you do not know the answer or are unsure, do not change anything. Never guess.
3. **Communication First**: Adopt a "communication first" (request for change) approach. Seek alignment before making modifications.
4. **Protect Critical Files**: Avoid accessing or manipulating critical file structures meant to be kept strictly in the repo. If something is missing, request it rather than assuming or generating it.
5. **Maintain Context Documents**: Whenever significant code or structural changes are made, ensure that all context files (like `README.md`, `ARCHITECTURE.md`, and `CHANGELOG.md`) are updated to reflect the new state of the project.
