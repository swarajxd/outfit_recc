/**
 * FitSense - Imagen Client
 * Node.js module: calls Python image_gen_service after YOLO pipeline completes.
 *
 * Usage:
 *   const { generateWardrobeBatch } = require('./imagen_client');
 *
 *   const result = await generateWardrobeBatch({
 *     userId: 'user123',
 *     outfitImagePath: 'uploads/user123_photo.jpg',
 *     pipelineResults: pythonPipelineOutput   // direct output from pipeline.process_outfit()
 *   });
 */

const axios = require('axios');
const path  = require('path');

// ---------------------------------------------------------------------------
// Config — set IMAGE_GEN_SERVICE_URL in your .env
// ---------------------------------------------------------------------------
const IMAGE_GEN_SERVICE_URL = process.env.IMAGE_GEN_SERVICE_URL || 'http://localhost:8001';
const REQUEST_TIMEOUT_MS    = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || '120000'); // 2 min


// ---------------------------------------------------------------------------
// Transform pipeline output → request body for image_gen_service
// ---------------------------------------------------------------------------

/**
 * Maps the Python pipeline's results dict into the format expected by
 * POST /generate-wardrobe-batch
 *
 * Python pipeline returns:
 *   results.segmented_items  = { "tshirt": ["path/to/crop.jpg", ...], "pants": [...] }
 *   results.classified_items = [{ category, image, attributes: { color, pattern, confidence } }]
 *
 * @param {string}  userId
 * @param {string}  outfitImagePath
 * @param {object}  pipelineResults   - direct output from pipeline.process_outfit()
 * @returns {object} request body for /generate-wardrobe-batch
 */
function buildBatchRequest(userId, outfitImagePath, pipelineResults) {
  const items = [];

  const segmentedItems   = pipelineResults.segmented_items  || {};
  const classifiedItems  = pipelineResults.classified_items || [];

  // Build a lookup: image_path → classification attributes
  const classificationMap = {};
  for (const classified of classifiedItems) {
    if (classified.image) {
      classificationMap[classified.image] = classified.attributes || {};
    }
  }

  // Walk segmented_items: { category: [path, path, ...] }
  for (const [category, imagePaths] of Object.entries(segmentedItems)) {
    if (!Array.isArray(imagePaths)) continue;

    for (const imagePath of imagePaths) {
      const attrs = classificationMap[imagePath] || {};

      items.push({
        category:    category,
        image_path:  imagePath,
        color:       attrs.color?.color   || attrs.color   || 'unknown',
        pattern:     attrs.pattern?.pattern || attrs.pattern || '',
        confidence:  typeof attrs.confidence === 'number' ? attrs.confidence : 1.0,
      });
    }
  }

  return {
    user_id:            userId,
    outfit_image_path:  outfitImagePath,
    items:              items,
    skip_low_confidence: true,
    confidence_threshold: 0.5,
  };
}


// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Generate ghost mannequin wardrobe images for all items in an outfit.
 *
 * @param {object} params
 * @param {string} params.userId              - FitSense user ID
 * @param {string} params.outfitImagePath     - path to original full outfit photo
 * @param {object} params.pipelineResults     - output from Python pipeline.process_outfit()
 * @returns {Promise<BatchGenerationResult>}
 */
async function generateWardrobeBatch({ userId, outfitImagePath, pipelineResults }) {
  if (!userId)           throw new Error('userId is required');
  if (!outfitImagePath)  throw new Error('outfitImagePath is required');
  if (!pipelineResults)  throw new Error('pipelineResults is required');

  const requestBody = buildBatchRequest(userId, outfitImagePath, pipelineResults);

  if (requestBody.items.length === 0) {
    console.warn('[imagen_client] No items to generate — segmented_items is empty');
    return {
      userId,
      outfitImagePath,
      totalItems: 0,
      successful: 0,
      failed: 0,
      items: [],
      batchId: null,
      generatedAt: new Date().toISOString(),
    };
  }

  console.log(`[imagen_client] Sending batch: ${requestBody.items.length} items for user ${userId}`);

  try {
    const response = await axios.post(
      `${IMAGE_GEN_SERVICE_URL}/generate-wardrobe-batch`,
      requestBody,
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = response.data;
    console.log(`[imagen_client] Batch ${data.batch_id} done | success=${data.successful} | failed=${data.failed}`);

    // Return camelCase version for Node.js consumers
    return {
      userId:           data.user_id,
      outfitImagePath:  data.outfit_image_path,
      totalItems:       data.total_items,
      successful:       data.successful,
      failed:           data.failed,
      batchId:          data.batch_id,
      generatedAt:      data.generated_at,
      items:            data.items.map(normalizeItem),
    };

  } catch (error) {
    const msg = error.response?.data?.detail || error.message;
    console.error(`[imagen_client] Batch generation failed: ${msg}`);
    throw new Error(`Image generation failed: ${msg}`);
  }
}


/**
 * Generate a single wardrobe image (useful for regenerating one item).
 *
 * @param {object} item  - { category, imagePath, color, pattern, confidence }
 * @returns {Promise<GeneratedItem>}
 */
async function generateSingleItem({ category, imagePath, color, pattern, confidence }) {
  const response = await axios.post(
    `${IMAGE_GEN_SERVICE_URL}/generate-single`,
    {
      category,
      image_path:  imagePath,
      color:       color   || 'unknown',
      pattern:     pattern || '',
      confidence:  confidence ?? 1.0,
    },
    {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return normalizeItem(response.data);
}


/**
 * Health check — verify the Python service is running before making calls.
 * @returns {Promise<boolean>}
 */
async function isServiceHealthy() {
  try {
    const res = await axios.get(`${IMAGE_GEN_SERVICE_URL}/health`, { timeout: 5000 });
    return res.data?.status === 'ok';
  } catch {
    return false;
  }
}


// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize snake_case API response → camelCase for Node.js
 */
function normalizeItem(item) {
  return {
    category:            item.category,
    originalCropPath:    item.original_crop_path,
    generatedImagePath:  item.generated_image_path,
    generatedImageUrl:   item.generated_image_url
                           ? `${IMAGE_GEN_SERVICE_URL}${item.generated_image_url}`
                           : null,
    promptUsed:          item.prompt_used,
    color:               item.color,
    success:             item.success,
    error:               item.error || null,
  };
}


// ---------------------------------------------------------------------------
// Express route helper (drop-in middleware for FitSense API)
// ---------------------------------------------------------------------------

/**
 * Express route handler for POST /api/outfit/process
 * Expects req.body: { userId, outfitImagePath, pipelineResults }
 *
 * Example:
 *   const { outfitProcessRoute } = require('./imagen_client');
 *   router.post('/api/outfit/process', outfitProcessRoute);
 */
async function outfitProcessRoute(req, res) {
  const { userId, outfitImagePath, pipelineResults } = req.body;

  if (!userId || !outfitImagePath || !pipelineResults) {
    return res.status(400).json({
      error: 'Missing required fields: userId, outfitImagePath, pipelineResults'
    });
  }

  try {
    // Optional: check service health before proceeding
    const healthy = await isServiceHealthy();
    if (!healthy) {
      return res.status(503).json({ error: 'Image generation service unavailable' });
    }

    const result = await generateWardrobeBatch({ userId, outfitImagePath, pipelineResults });
    return res.json({ success: true, wardrobe: result });

  } catch (error) {
    console.error('[outfitProcessRoute]', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}


module.exports = {
  generateWardrobeBatch,
  generateSingleItem,
  isServiceHealthy,
  outfitProcessRoute,
  buildBatchRequest,   // exported for testing
};