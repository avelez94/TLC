// Resources store either an external http(s) URL or a private storage path written as
// "storage:<path>". Portals always open resources through /api/resources/<id>/open, which
// checks access and issues a short-lived signed URL for stored files.
export const STORAGE_PREFIX = 'storage:'

export function resourceOpenHref(resource: { id: string; url: string | null }): string | undefined {
  return resource.url ? `/api/resources/${resource.id}/open` : undefined
}
