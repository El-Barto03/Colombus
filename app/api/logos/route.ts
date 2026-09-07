import {
  storeLogo,
  uploadedLogoUrl,
} from "@/lib/logo-storage";

export const dynamic = "force-dynamic";

const allowedImageTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const maxLogoBytes = 2_000_000;
const maxCropSourceBytes = 10_000_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

class LogoImportError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) return true;

  if (host.includes(":")) {
    return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || /^fe[89ab]/.test(host);
  }

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function safeRemoteUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4_000) {
    throw new LogoImportError("Drop an image itself, not the page it appears on.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LogoImportError("This image address is not valid.");
  }
  const unusualPort = Boolean(
    url.port &&
    !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")),
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    unusualPort ||
    isPrivateHost(url.hostname)
  ) {
    throw new LogoImportError("This image address cannot be imported.");
  }
  return url;
}

function hasExpectedSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (contentType === "image/gif") {
    return bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 3)) === "GIF";
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function readImageBytes(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new LogoImportError("The dropped image was empty.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new LogoImportError(
        limit === maxLogoBytes
          ? "Logo images must be 2 MB or smaller."
          : "Images prepared for cropping must be 10 MB or smaller.",
        413,
      );
    }
    chunks.push(value);
  }
  if (!total) throw new LogoImportError("The dropped image was empty.");

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function importRemoteLogo(value: unknown, limit = maxLogoBytes) {
  let url = safeRemoteUrl(value);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
      });
    } catch {
      throw new LogoImportError(
        "That website would not allow the image to be copied. Try another source.",
        502,
      );
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) {
        throw new LogoImportError("The image redirected too many times.");
      }
      url = safeRemoteUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      throw new LogoImportError(
        "That website would not allow the image to be copied. Try another source.",
        502,
      );
    }

    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    const extension = allowedImageTypes[contentType];
    if (!extension) {
      throw new LogoImportError("The dropped item is not a supported PNG, JPG, WEBP or GIF image.");
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > limit) {
      throw new LogoImportError(
        limit === maxLogoBytes
          ? "Logo images must be 2 MB or smaller."
          : "Images prepared for cropping must be 10 MB or smaller.",
        413,
      );
    }

    const bytes = await readImageBytes(response, limit);
    if (!hasExpectedSignature(bytes, contentType)) {
      throw new LogoImportError("The dropped item is not a valid image.");
    }

    return { bytes, contentType, extension, source: url.href };
  }
  throw new LogoImportError("The image could not be imported.");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2_200_000) {
      return Response.json({ error: "Logo images must be 2 MB or smaller." }, { status: 413 });
    }

    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const body = await request.json() as { imageUrl?: unknown; preview?: unknown };
      const preview = body.preview === true;
      const imported = await importRemoteLogo(
        body.imageUrl,
        preview ? maxCropSourceBytes : maxLogoBytes,
      );
      if (preview) {
        return new Response(imported.bytes, {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Type": imported.contentType,
          },
        });
      }
      const id = crypto.randomUUID() + "." + imported.extension;
      await storeLogo(id, imported.bytes, imported.contentType);
      return Response.json({ logoUrl: uploadedLogoUrl(id) }, { status: 201 });
    }

    const formData = await request.formData();
    const file = formData.get("logo");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a logo image to upload." }, { status: 400 });
    }
    if (!file.size || file.size > maxLogoBytes) {
      return Response.json({ error: "Logo images must be 2 MB or smaller." }, { status: 400 });
    }

    const extension = allowedImageTypes[file.type];
    if (!extension) {
      return Response.json(
        { error: "Choose a PNG, JPG, WEBP or GIF image." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID() + "." + extension;
    await storeLogo(id, new Uint8Array(await file.arrayBuffer()), file.type);

    return Response.json({ logoUrl: uploadedLogoUrl(id) }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload logo", error);
    if (error instanceof LogoImportError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "The logo could not be uploaded. Please try again." },
      { status: 500 },
    );
  }
}
