const FormData = require("form-data");

function formDataToBuffer(form) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    form.on("data", (chunk) => {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "binary"),
      );
    });
    form.on("error", reject);
    form.on("end", () => resolve(Buffer.concat(chunks)));
    form.resume();
  });
}

function toAnalysisUrl(imageUrl) {
  let analysisUrl = imageUrl;
  try {
    const uploadMarker = "/upload/";
    if (analysisUrl.includes(uploadMarker)) {
      analysisUrl = analysisUrl.replace(uploadMarker, "/upload/f_jpg/");
    }
  } catch {
    analysisUrl = imageUrl;
  }
  return analysisUrl;
}

// Kept signature-friendly for future expansion.
// imagePath here is a remote URL in current flow.
async function processPost(imagePath, user_id, caption, tags, opts = {}) {
  console.log("PIPELINE RUNNING");
  const { outfitApiUrl } = opts;
  if (!outfitApiUrl) throw new Error("outfitApiUrl is required");
  if (!imagePath) throw new Error("imagePath is required");

  const analysisUrl = toAnalysisUrl(imagePath);
  const imgResp = await fetch(analysisUrl);
  if (!imgResp.ok) {
    throw new Error(`failed to download image: ${imgResp.status}`);
  }
  const buf = Buffer.from(await imgResp.arrayBuffer());
  const contentType = imgResp.headers.get("content-type") || "image/jpeg";

  const form = new FormData();
  form.append("file", buf, { filename: "post.jpg", contentType });
  form.append("user_id", String(user_id || "post_user"));

  const headers = form.getHeaders();
  const body = await formDataToBuffer(form);
  headers["Content-Length"] = String(body.length);

  const vectResp = await fetch(`${outfitApiUrl}/analyze-post`, {
    method: "POST",
    body,
    headers,
  });
  if (!vectResp.ok) {
    const errText = await vectResp.text();
    throw new Error(errText || `outfit api failed: ${vectResp.status}`);
  }

  const outfit_data = await vectResp.json();
  return {
    outfit_data,
    image_url: imagePath,
    other_metadata: { user_id, caption, tags },
  };
}

module.exports = {
  processPost,
};

