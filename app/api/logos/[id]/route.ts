import { downloadLogo } from "@/lib/logo-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp|gif)$/.test(id)) return new Response("Invalid logo id.", { status: 400 });

  try {
    const object = await downloadLogo(id);
    if (object.error || !object.data) return new Response("Logo not found.", { status: 404 });
    return new Response(object.data, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": object.data.type || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to read logo", error);
    return new Response("The logo could not be loaded.", { status: 500 });
  }
}
