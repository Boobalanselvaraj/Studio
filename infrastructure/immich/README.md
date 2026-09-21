> Implementation contract: [Plan v4, section 12](../../STUDIO_PLATFORM_IMPLEMENTATION_PLAN.md#12-immich-developer-only-integration-contract). Express and its backend workers are the only callers of Immich. Indexing, thumbnails, EXIF and face detection require the real adapter, storage bridge and compatible machine-learning services described there. The current worker only saves a supplied engine asset ID; the current Compose configuration publishes a host port, so internal-only deployment is not yet enforced.

# Immich Media Engine Integration

Immich serves as the internal media indexing engine for the Photo Studio SaaS platform.

## Architecture Guidelines
- Immich is strictly internal; never exposed directly to the public web or client applications.
- Express API acts as the proxy and controller for all media indexing, thumbnail generation, EXIF parsing, and face/object detection queries.
- Immich API key is stored securely in backend environment configurations (`IMMICH_API_KEY`).

