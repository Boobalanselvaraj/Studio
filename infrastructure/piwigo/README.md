# Piwigo Evaluation Track

Piwigo is configured as an isolated, optional evaluation service.

## Usage
- To run Piwigo alongside the stack for evaluation comparison:
  ```bash
  docker compose --profile evaluation up -d piwigo
  ```
- Accessible on internal port 8085 for feature and performance benchmark comparison against Immich.
