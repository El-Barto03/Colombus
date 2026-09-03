import { getLogoBucket, logoStorageKey } from "@/lib/logo-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp|gif)$/.test(id)) {
    return new Response("Invalid logo id.", { status: 400 });
  }

  try {
    const object = await getLogoBucket().get(logoStorageKey(id));
    if (!object) return new Response("Logo not found.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Unable to read logo", error);
    return new Response("The logo could not be loaded.", { status: 500 });
  }
}
