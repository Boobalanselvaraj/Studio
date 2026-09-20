# Immich Media Engine Integration

Immich serves as the internal media indexing engine for the Photo Studio SaaS platform.

## Architecture Guidelines
- Immich is strictly internal; never exposed directly to the public web or client applications.
- Express API acts as the proxy and controller for all media indexing, thumbnail generation, EXIF parsing, and face/object detection queries.
- Immich API key is stored securely in backend environment configurations (`IMMICH_API_KEY`).
