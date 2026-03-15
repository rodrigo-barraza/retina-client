/**
 * WorkflowExecutor — executes a workflow graph by topologically sorting nodes
 * and calling PrismService for each model, passing outputs forward via connections.
 */
import { PrismService } from "./PrismService";

/**
 * Determine which Prism endpoint to use based on the model's modalities
 * and the types of inputs it's receiving.
 *
 * textToText handles images via the `images` field in messages and
 * properly sends system prompts as system messages, so we prefer it
 * over the dedicated imageToText captioning endpoint.
 */
function resolveEndpoint(node, inputData) {
    const hasAudioInput = inputData.some((d) => d.type === "audio");
    const outputsImage = (node.outputTypes || []).includes("image");
    const outputsAudio = (node.outputTypes || []).includes("audio");
    const outputsEmbedding = (node.outputTypes || []).includes("embedding");

    // Embedding generation: → embedding output
    if (outputsEmbedding) return "modalityToEmbedding";
    // Image generation: → image output
    if (outputsImage) return "textToImage";
    // Audio transcription: audio in → text out
    if (hasAudioInput && !outputsAudio) return "audioToText";
    // TTS: → audio output
    if (outputsAudio) return "textToSpeech";
    // Default: chat (handles multimodal inputs including images)
    return "textToText";
}

/**
 * Resolve a minio:// or other file ref to a fetchable URL, then convert to base64 data URL.
 * Also handles object refs like { imageData, mimeType } from chat API responses.
 */
async function resolveToDataUrl(ref) {
    if (!ref) return ref;
    // Object with inline base64 data (chat API image format: { data, mimeType, minioRef })
    if (typeof ref === "object") {
        // Prefer minioRef if available (lightweight URL instead of base64 blob)
        if (ref.minioRef) return PrismService.getFileUrl(ref.minioRef);
        const b64 = ref.data || ref.imageData;
        if (b64) {
            const mime = ref.mimeType || "image/png";
            return `data:${mime};base64,${b64}`;
        }
        return null;
    }
    if (typeof ref !== "string") return null;
    // Already a data URL — return as-is
    if (ref.startsWith("data:")) return ref;
    // HTTP URL or minio:// ref — resolve to HTTP URL (no base64 conversion)
    return PrismService.getFileUrl(ref);
}

/**
 * Execute a single model node.
 * @param {Object} node - The workflow node
 * @param {Array<{type: string, data: string}>} inputData - Collected inputs from connections
 * @returns {Promise<Object>} - { [modality]: data }
 */
async function executeModelNode(node, inputData) {
    const endpoint = resolveEndpoint(node, inputData);
    const outputs = {};

    if (endpoint === "textToText") {
        // Collect piped inputs from connections
        const textParts = inputData.filter((d) => d.type === "text").map((d) => d.data);
        const imageParts = inputData.filter((d) => d.type === "image").map((d) => d.data);
        const audioParts = inputData.filter((d) => d.type === "audio").map((d) => d.data);
        const videoParts = inputData.filter((d) => d.type === "video").map((d) => d.data);
        const pdfParts = inputData.filter((d) => d.type === "pdf").map((d) => d.data);
        const conversationParts = inputData.filter((d) => d.type === "conversation").map((d) => d.data);
        const pipedText = textParts.join("\n\n");
        const hasMedia = imageParts.length > 0 || audioParts.length > 0 || videoParts.length > 0 || pdfParts.length > 0;

        // Helper: merge piped media fields into a message
        const buildMediaFields = (existing = {}) => {
            const fields = {};
            const imgs = [...(existing.images || []), ...imageParts];
            if (imgs.length > 0) fields.images = imgs;
            if (existing.audio || audioParts[0]) fields.audio = existing.audio || audioParts[0];
            if (existing.video || videoParts[0]) fields.video = existing.video || videoParts[0];
            if (existing.pdf || pdfParts[0]) fields.pdf = existing.pdf || pdfParts[0];
            return fields;
        };

        let finalMessages;

        // Priority: conversation input > node.messages > legacy systemPrompt/userPrompt
        if (conversationParts.length > 0) {
            // Use the first conversation input as the base messages, filtering out empty ones
            finalMessages = conversationParts[0]
                .map((m) => ({
                    role: m.role,
                    content: m.content || "",
                    ...(m.images?.length > 0 ? { images: m.images } : {}),
                    ...(m.audio ? { audio: m.audio } : {}),
                    ...(m.video ? { video: m.video } : {}),
                    ...(m.pdf ? { pdf: m.pdf } : {}),
                }))
                .filter((m) => m.content || m.images?.length > 0 || m.audio || m.video || m.pdf);

            // Append piped text/media to the last user message (or add a new one)
            const lastUserIdx = finalMessages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === "user").pop()?.i;
            if (lastUserIdx !== undefined && (pipedText || hasMedia)) {
                const lastUser = finalMessages[lastUserIdx];
                finalMessages[lastUserIdx] = {
                    ...lastUser,
                    content: pipedText ? (lastUser.content ? `${lastUser.content}\n\n${pipedText}` : pipedText) : lastUser.content,
                    ...buildMediaFields(lastUser),
                };
            } else if (pipedText || hasMedia) {
                finalMessages.push({
                    role: "user",
                    content: pipedText || "",
                    ...buildMediaFields(),
                });
            }
        } else if (node.messages && node.messages.length > 0) {
            // Use the full conversation messages array, preserving all media
            finalMessages = node.messages.map((m) => ({
                role: m.role,
                content: m.content || "",
                ...(m.images?.length > 0 ? { images: m.images } : {}),
                ...(m.audio ? { audio: m.audio } : {}),
                ...(m.video ? { video: m.video } : {}),
                ...(m.pdf ? { pdf: m.pdf } : {}),
            }));

            // Append piped text/media to the last user message (or add a new one)
            const lastUserIdx = finalMessages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === "user").pop()?.i;
            if (lastUserIdx !== undefined && (pipedText || hasMedia)) {
                const lastUser = finalMessages[lastUserIdx];
                finalMessages[lastUserIdx] = {
                    ...lastUser,
                    content: pipedText ? (lastUser.content ? `${lastUser.content}\n\n${pipedText}` : pipedText) : lastUser.content,
                    ...buildMediaFields(lastUser),
                };
            } else if (pipedText || hasMedia) {
                // No user message exists — create one for piped input
                finalMessages.push({
                    role: "user",
                    content: pipedText || "",
                    ...buildMediaFields(),
                });
            }
        } else {
            // Legacy: build from systemPrompt/userPrompt
            const content = node.userPrompt
                ? (pipedText ? `${node.userPrompt}\n\n${pipedText}` : node.userPrompt)
                : pipedText || "";

            const systemMsg = node.systemPrompt
                ? [{ role: "system", content: node.systemPrompt }]
                : [];
            const userMsg = {
                role: "user",
                content,
                ...buildMediaFields(),
            };
            finalMessages = [...systemMsg, userMsg];
        }

        const result = await PrismService.generateText({
            provider: node.provider,
            model: node.modelName,
            messages: finalMessages,
        });

        outputs.text = result.text || result.content || "";
        // Some models return inline images
        if (result.images && result.images.length > 0) {
            outputs.image = await resolveToDataUrl(result.images[0]);
        }
    } else if (endpoint === "textToImage") {
        const pipedPrompt = inputData.find((d) => d.type === "text")?.data || "";
        const rawImages = inputData.filter((d) => d.type === "image").map((d) => d.data);
        const conversationParts = inputData.filter((d) => d.type === "conversation").map((d) => d.data);

        let prompt;
        let systemPrompt;
        const messageImages = [];

        if (conversationParts.length > 0) {
            // Extract from conversation input: system message → systemPrompt, user messages → prompt + images
            const convMessages = conversationParts[0].filter((m) => m.content || m.images?.length > 0 || m.audio);
            const systemMsg = convMessages.find((m) => m.role === "system");
            const userMsgs = convMessages.filter((m) => m.role === "user");
            const lastUser = userMsgs[userMsgs.length - 1];

            systemPrompt = systemMsg?.content || undefined;
            const userContent = lastUser?.content || "";
            prompt = pipedPrompt
                ? (userContent ? `${userContent}\n\n${pipedPrompt}` : pipedPrompt)
                : userContent;

            // Collect images from all user messages
            userMsgs.forEach((m) => {
                if (m.images?.length > 0) messageImages.push(...m.images);
            });
        } else if (node.messages && node.messages.length > 0) {
            // Extract from messages array: last user message = prompt, system message = systemPrompt
            const systemMsg = node.messages.find((m) => m.role === "system");
            const userMsgs = node.messages.filter((m) => m.role === "user");
            const lastUser = userMsgs[userMsgs.length - 1];

            systemPrompt = systemMsg?.content || undefined;
            const userContent = lastUser?.content || "";
            prompt = pipedPrompt
                ? (userContent ? `${userContent}\n\n${pipedPrompt}` : pipedPrompt)
                : userContent;

            // Collect images from all user messages
            userMsgs.forEach((m) => {
                if (m.images?.length > 0) messageImages.push(...m.images);
            });
        } else {
            // Legacy: use systemPrompt/userPrompt fields
            systemPrompt = node.systemPrompt || undefined;
            prompt = node.userPrompt
                ? (pipedPrompt ? `${node.userPrompt}\n\n${pipedPrompt}` : node.userPrompt)
                : pipedPrompt;
        }

        // Merge piped images + message images
        const allRawImages = [...rawImages, ...messageImages];

        // Convert data URLs → { imageData, mimeType } objects for Prism/providers
        const images = allRawImages.map((img) => {
            if (typeof img === "string" && img.startsWith("data:")) {
                const match = img.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return { imageData: match[2], mimeType: match[1] };
                }
            }
            // Already an object or fallback
            return typeof img === "object" ? img : { imageData: img, mimeType: "image/jpeg" };
        });

        const result = await PrismService.generateImage({
            provider: node.provider,
            model: node.modelName,
            prompt,
            systemPrompt,
            images: images.length > 0 ? images : undefined,
        });

        // Chat-based image models return { images: [...], text }
        if (result.images && result.images.length > 0) {
            outputs.image = await resolveToDataUrl(result.images[0]);
        } else if (result.imageData) {
            const mime = result.mimeType || "image/png";
            outputs.image = `data:${mime};base64,${result.imageData}`;
        } else if (result.minioRef) {
            outputs.image = await resolveToDataUrl(result.minioRef);
        }
        if (result.text) {
            outputs.text = result.text;
        }
    } else if (endpoint === "audioToText") {
        const audio = inputData.find((d) => d.type === "audio")?.data || "";
        const result = await PrismService.transcribeAudio({
            provider: node.provider,
            model: node.modelName,
            audio,
            ...(node.userPrompt ? { prompt: node.userPrompt } : node.systemPrompt ? { prompt: node.systemPrompt } : {}),
        });

        outputs.text = result.text || "";
    } else if (endpoint === "textToSpeech") {
        const text = inputData.find((d) => d.type === "text")?.data || "";
        const result = await PrismService.generateSpeech({
            provider: node.provider,
            model: node.modelName,
            text,
        });

        outputs.audio = result.audioDataUrl || "";
    } else if (endpoint === "modalityToEmbedding") {
        const textParts = inputData.filter((d) => d.type === "text").map((d) => d.data);
        const imageParts = inputData.filter((d) => d.type === "image").map((d) => d.data);
        const audioPart = inputData.find((d) => d.type === "audio")?.data;

        const payload = {
            provider: node.provider,
            model: node.modelName,
        };

        // Combine user prompt with piped text
        const pipedText = textParts.join("\n\n");
        const combinedText = node.userPrompt
            ? (pipedText ? `${node.userPrompt}\n\n${pipedText}` : node.userPrompt)
            : pipedText;
        if (combinedText) payload.text = combinedText;
        if (imageParts.length > 0) payload.images = imageParts;
        if (audioPart) payload.audio = audioPart;

        const result = await PrismService.generateEmbedding(payload);
        outputs.embedding = result.embedding;
    }

    return outputs;
}

/**
 * Topological sort of nodes based on connection graph.
 */
function topologicalSort(nodes, connections) {
    const inDegree = {};
    const adjacency = {};
    for (const node of nodes) {
        inDegree[node.id] = 0;
        adjacency[node.id] = [];
    }
    for (const conn of connections) {
        inDegree[conn.targetNodeId] = (inDegree[conn.targetNodeId] || 0) + 1;
        adjacency[conn.sourceNodeId] = adjacency[conn.sourceNodeId] || [];
        adjacency[conn.sourceNodeId].push(conn.targetNodeId);
    }

    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const sorted = [];

    while (queue.length > 0) {
        const current = queue.shift();
        sorted.push(current);
        for (const neighbor of adjacency[current] || []) {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        }
    }

    return sorted;
}

/**
 * Execute the entire workflow.
 * @param {Array} nodes - Workflow nodes
 * @param {Array} connections - Workflow connections
 * @param {Function} onNodeStart - Called when a node begins execution (nodeId)
 * @param {Function} onNodeComplete - Called when a node completes (nodeId, outputs)
 * @param {Function} onNodeError - Called when a node errors (nodeId, error)
 * @param {Function} onViewerPartial - Called when a viewer receives partial output (viewerNodeId, partialOutputs)
 */
export async function executeWorkflow(nodes, connections, { onNodeStart, onNodeComplete, onNodeError, onViewerPartial }) {
    const sortedIds = topologicalSort(nodes, connections);
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // Store outputs: nodeId → { [modality]: data }
    const nodeOutputs = {};

    // Pre-compute which viewers each node feeds into
    const viewerConnsBySource = {};
    for (const conn of connections) {
        const targetNode = nodeMap[conn.targetNodeId];
        if (targetNode?.nodeType === "viewer") {
            (viewerConnsBySource[conn.sourceNodeId] ??= []).push(conn);
        }
    }

    // Track partial viewer outputs (accumulated as upstream nodes complete)
    const viewerPartials = {};

    for (const nodeId of sortedIds) {
        const node = nodeMap[nodeId];
        if (!node) continue;

        try {
            onNodeStart?.(nodeId);

            if (node.nodeType === "input") {
                // Conversation input nodes emit their messages array, merging piped inputs
                if (node.modality === "conversation") {
                    const messages = JSON.parse(JSON.stringify(node.messages || []));

                    // Collect piped data from upstream connections using compound port IDs
                    // Port format: "{msgIndex}.{modality}" e.g. "0.text", "1.image"
                    const incomingConns = connections.filter((c) => c.targetNodeId === nodeId);

                    for (const conn of incomingConns) {
                        const sourceOut = nodeOutputs[conn.sourceNodeId];
                        if (!sourceOut) continue;
                        const data = sourceOut[conn.sourceModality];
                        if (!data) continue;

                        // Parse compound port ID to route data to correct message slot
                        const dotIdx = conn.targetModality.indexOf(".");
                        if (dotIdx === -1) continue;
                        const msgIdx = parseInt(conn.targetModality.substring(0, dotIdx));
                        const modality = conn.targetModality.substring(dotIdx + 1);

                        if (msgIdx < 0 || msgIdx >= messages.length) continue;
                        const msg = messages[msgIdx];

                        if (modality === "text") {
                            msg.content = msg.content
                                ? `${msg.content}\n\n${data}`
                                : data;
                        } else if (modality === "image") {
                            msg.images = [...(msg.images || []), data];
                        } else if (modality === "audio") {
                            msg.audio = data;
                        } else if (modality === "video") {
                            msg.video = data;
                        } else if (modality === "pdf") {
                            msg.pdf = data;
                        }
                    }

                    nodeOutputs[nodeId] = { conversation: messages };
                } else {
                    // Input asset nodes just emit their content under the active modality
                    nodeOutputs[nodeId] = node.modality
                        ? { [node.modality]: node.content || "" }
                        : {}; // file input with no file loaded
                }
                onNodeComplete?.(nodeId, nodeOutputs[nodeId]);

                // Push partial updates to any connected viewers
                if (viewerConnsBySource[nodeId]) {
                    for (const conn of viewerConnsBySource[nodeId]) {
                        const data = nodeOutputs[nodeId]?.[conn.sourceModality];
                        if (data) {
                            viewerPartials[conn.targetNodeId] ??= {};
                            viewerPartials[conn.targetNodeId][conn.targetModality] = data;
                            onViewerPartial?.(conn.targetNodeId, { ...viewerPartials[conn.targetNodeId] });
                        }
                    }
                }
                continue;
            }

            if (node.nodeType === "viewer") {
                // Viewer nodes collect connected input data and display it
                const incomingConns = connections.filter((c) => c.targetNodeId === nodeId);
                const collectedOutputs = {};

                for (const conn of incomingConns) {
                    const sourceOutputs = nodeOutputs[conn.sourceNodeId];
                    if (sourceOutputs && sourceOutputs[conn.sourceModality] !== undefined) {
                        collectedOutputs[conn.targetModality] = sourceOutputs[conn.sourceModality];
                    }
                }

                nodeOutputs[nodeId] = collectedOutputs;
                onNodeComplete?.(nodeId, collectedOutputs);
                continue;
            }

            // Model node — gather inputs from connections
            const incomingConns = connections.filter((c) => c.targetNodeId === nodeId);
            const inputData = [];

            for (const conn of incomingConns) {
                const sourceOutputs = nodeOutputs[conn.sourceNodeId];
                if (sourceOutputs && sourceOutputs[conn.sourceModality] !== undefined) {
                    inputData.push({
                        type: conn.targetModality,
                        data: sourceOutputs[conn.sourceModality],
                    });
                }
            }

            // Also include any static inputs attached to the node
            if (node.staticInputs) {
                for (const [modality, data] of Object.entries(node.staticInputs)) {
                    if (data) {
                        inputData.push({ type: modality, data });
                    }
                }
            }

            // Execute the model
            const outputs = await executeModelNode(node, inputData);
            nodeOutputs[nodeId] = outputs;
            onNodeComplete?.(nodeId, outputs);

            // Push partial updates to any connected viewers
            if (viewerConnsBySource[nodeId]) {
                for (const conn of viewerConnsBySource[nodeId]) {
                    const data = outputs[conn.sourceModality];
                    if (data) {
                        viewerPartials[conn.targetNodeId] ??= {};
                        viewerPartials[conn.targetNodeId][conn.targetModality] = data;
                        onViewerPartial?.(conn.targetNodeId, { ...viewerPartials[conn.targetNodeId] });
                    }
                }
            }
        } catch (error) {
            onNodeError?.(nodeId, error);
            // Put empty outputs so downstream nodes don't hang
            nodeOutputs[nodeId] = {};
        }
    }

    return nodeOutputs;
}
