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

    // Image generation: → image output
    if (outputsImage) return "textToImage";
    // Audio transcription: audio in → text out
    if (hasAudioInput && !outputsAudio) return "audioToText";
    // TTS: → audio output
    if (outputsAudio) return "textToSpeech";
    // Default: text-to-text (handles multimodal inputs including images)
    return "textToText";
}

/**
 * Resolve a minio:// or other file ref to a fetchable URL, then convert to base64 data URL.
 */
async function resolveToDataUrl(ref) {
    if (!ref) return ref;
    // Already a data URL — return as-is
    if (ref.startsWith("data:")) return ref;
    // HTTP URL or minio — resolve to renderable, then fetch and convert
    const url = PrismService.getFileUrl(ref);
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch {
        return url; // fallback to URL
    }
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
        // Build messages in the format Prism expects:
        // { role: "user", content: "text", images: [dataUrl, ...] }
        const textParts = inputData.filter((d) => d.type === "text").map((d) => d.data);
        const imageParts = inputData.filter((d) => d.type === "image").map((d) => d.data);
        // Combine user prompt (explicit instruction) with piped text inputs
        const pipedText = textParts.join("\n\n");
        const content = node.userPrompt
            ? (pipedText ? `${node.userPrompt}\n\n${pipedText}` : node.userPrompt)
            : pipedText || "";

        const systemMsg = node.systemPrompt
            ? [{ role: "system", content: node.systemPrompt }]
            : [];
        const userMsg = {
            role: "user",
            content,
            ...(imageParts.length > 0 ? { images: imageParts } : {}),
        };

        const result = await PrismService.generateText({
            provider: node.provider,
            model: node.modelName,
            messages: [...systemMsg, userMsg],
        });

        outputs.text = result.text || result.content || "";
        // Some models return inline images
        if (result.images && result.images.length > 0) {
            outputs.image = await resolveToDataUrl(result.images[0]);
        }
    } else if (endpoint === "textToImage") {
        const pipedPrompt = inputData.find((d) => d.type === "text")?.data || "";
        const rawImages = inputData.filter((d) => d.type === "image").map((d) => d.data);
        // userPrompt takes precedence; piped text is appended
        const prompt = node.userPrompt
            ? (pipedPrompt ? `${node.userPrompt}\n\n${pipedPrompt}` : node.userPrompt)
            : pipedPrompt;

        // Convert data URLs → { imageData, mimeType } objects for Prism/providers
        const images = rawImages.map((img) => {
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
            systemPrompt: node.systemPrompt || undefined,
            images: images.length > 0 ? images : undefined,
        });

        // Prism returns { imageData (base64), mimeType, minioRef }
        if (result.imageData) {
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
                // Input asset nodes just emit their content under the active modality
                nodeOutputs[nodeId] = node.modality
                    ? { [node.modality]: node.content || "" }
                    : {}; // file input with no file loaded
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
